import React, { useState, useCallback, useMemo } from 'react';

// ==================================================================
// Type Definitions
// ==================================================================

interface Log {
  type: 'INFO' | 'ACTION' | 'SUCCESS' | 'FAIL';
  message: string;
  index?: number; // Optional index for correlating with screenshots
}

interface ExecutionStep {
  action: 'navigate' | 'click' | 'type' | 'assert_visible';
  target: string;
  value?: string;
}

interface AgentResponse {
  status: 'SUCCESS' | 'FAILURE';
  logs: Log[];
  screenshotTimeline?: string[]; // Array of base64 encoded image strings
}

// ==================================================================
// Netlify Function Endpoint - DO NOT CHANGE
const AGENT_PROXY_URL = '/.netlify/functions/oci-proxy';
// ==================================================================

const apiKey = "AIzaSyCOPdMvaarEgHcXNZdTvyAKjWwuPVMS46M";
const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

// ==================================================================
// API Functions
// ==================================================================

const generateAIReasoning = async (status: string, logs: Log[]): Promise<string> => {
    const logText = logs.map(l => `[${l.type}] ${l.message}`).join('\n');
    let prompt;

    if (status === 'FAILURE') {
        const failureMessage = logs.slice().reverse().find(l => l.type === 'FAIL' || l.type === 'ACTION')?.message || "An unknown error occurred.";
        prompt = `The test failed on OCI agent. Analyze the logs, identify the technical root cause (e.g., element missing, timeout). Provide a concise, single-paragraph RCA summary. Failure message: "${failureMessage}". Full Logs:\n${logText}`;
    } else {
        prompt = `The test succeeded. Provide a one-sentence confirmation and briefly mention the total number of steps executed to confirm flow coverage. Full Logs:\n${logText}`;
    }

    const systemPrompt = "You are an AI Agent for a synthetic monitoring platform. Your task is to analyze the provided test run logs and provide a concise, single-paragraph root cause analysis (RCA) or confirmation report. Write in the persona of a senior DevOps engineer.";

    try {
        const response = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
            })
        });

        if (!response.ok) return "Error generating AI report: API call failed.";
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text || "AI analysis failed to return text.";

    } catch (error) {
        console.error("AI Generation Error:", error);
        if (error instanceof Error) {
            return `Failed to connect to the Gemini API for analysis. Error: ${error.message}`;
        }
        return "An unknown error occurred during AI analysis.";
    }
};

const resolveFlowPrompt = async (prompt: string): Promise<ExecutionStep[]> => {
    const systemPrompt = "You are a Flow Translator AI. Convert the user\'s plain-language monitoring flow into a precise JSON array of executable steps. Use simple locators (e.g., 'Sign In button', 'Username input') based on semantic HTML. If a step involves typing, use the 'type' action and include the input value.";
    
    const responseSchema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: {
                action: { type: "STRING", description: "The action type: navigate, click, type, or assert_visible." },
                target: { type: "STRING", description: "The text or semantic role of the element to target (e.g., 'Search button', 'Pricing link')." },
                value: { type: "STRING", description: "The text value to type, only used if action is 'type'." }
            },
            required: ["action", "target"]
        }
    };
    
    try {
        const response = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Translate this flow: ${prompt}` }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            })
        });

        if (response.ok) {
            const result = await response.json();
            const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (jsonText) return JSON.parse(jsonText);
        }
        
        throw new Error(`AI translation failed with status: ${response.status}`);

    } catch (error) {
        console.error("Prompt Resolution Error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`AI failed to resolve the prompt into an executable plan: ${message}`);
    }
};

const enhanceFlowPrompt = async (prompt: string): Promise<string> => {
    const userQuery = `Review the following synthetic monitoring flow description. Refine it to be more precise, descriptive, and robust by suggesting steps like asserting key elements are visible, clicking necessary cookie banners, or using specific links, if applicable. If the flow is simple, confirm it is adequate. Return only the revised/enhanced flow description text. Original Flow: ${prompt}`;
    const systemPrompt = "You are a Synthetic Flow Expert AI. You refine and optimize natural language descriptions for web automation scripts, ensuring they follow best practices for stability and coverage. Respond with only the revised natural language flow.";

    try {
        const response = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: userQuery }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
            })
        });

        if (!response.ok) throw new Error("API call failed.");
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text || "AI suggestion failed to return text.";

    } catch (error) {
        console.error("AI Enhancement Error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return `Error enhancing prompt: ${message}`;
    }
};

const callRemoteAgent = async (url: string, plan: ExecutionStep[]): Promise<AgentResponse> => {
    try {
        const response = await fetch(AGENT_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUrl: url, executionPlan: plan }),
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ error: 'Proxy returned a non-JSON error.' }));
            throw new Error(`Request failed (Status: ${response.status}). Details: ${errorBody.error || 'Check proxy and agent logs.'}`);
        }

        return response.json();

    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to execute flow via proxy. Details: ${message}`);
    }
};

// ==================================================================
// Components
// ==================================================================

interface LogDisplayProps {
    logs: Log[];
    loading: boolean;
}

const LogDisplay: React.FC<LogDisplayProps> = ({ logs, loading }) => {
    const getLogColor = (type: Log['type']) => {
        switch (type) {
            case 'INFO': return 'text-sky-400';
            case 'ACTION': return 'text-amber-300';
            case 'SUCCESS': return 'text-green-400';
            case 'FAIL': return 'text-red-500 font-semibold';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="h-full bg-gray-950 p-4 rounded-b-lg overflow-y-auto font-mono text-sm border border-t-0 border-gray-700">
            {logs.length === 0 && !loading ? (
                <p className="text-gray-500">No logs yet. Enter a URL and a flow prompt to start monitoring.</p>
            ) : (
                logs.map((log, index) => (
                    <div key={index} className="flex space-x-2">
                        <span className="text-gray-600">[{index + 1}]</span>
                        <span className={getLogColor(log.type)}>[{log.type}]</span>
                        <span className="text-white break-words">{log.message}</span>
                    </div>
                ))
            )}
            {loading && (
                <div className="flex items-center text-sky-400 mt-2">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Executing flow...
                </div>
            )}
        </div>
    );
};

interface TimelineDisplayProps {
    timeline: string[];
    logs: Log[];
}

const TimelineDisplay: React.FC<TimelineDisplayProps> = ({ timeline, logs }) => {
    const [currentStep, setCurrentStep] = useState(0);

    React.useEffect(() => {
        setCurrentStep(0);
    }, [timeline]);

    if (!timeline || timeline.length === 0) {
        return <div className="text-center p-8 text-gray-500 bg-gray-950 rounded-b-lg h-full">No screenshots captured yet.</div>;
    }

    const currentLog = logs.find(log => log.index === currentStep + 1);
    const screenshotSrc = `data:image/png;base64,${timeline[currentStep]}`;
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        e.currentTarget.onerror = null; 
        e.currentTarget.src = "https://placehold.co/1280x720/1f2937/9ca3af?text=Screenshot+Missing";
    };

    return (
        <div className="h-full flex flex-col md:flex-row bg-gray-950 rounded-b-lg overflow-hidden">
            <div className="flex-1 p-4 flex flex-col justify-between items-center bg-gray-900 border-r border-gray-700 md:h-full">
                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                    <img 
                        src={screenshotSrc} 
                        alt={`Step ${currentStep + 1} screenshot`} 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-xl border border-gray-700"
                        onError={handleImageError}
                    />
                </div>
                <div className="flex items-center justify-center space-x-4 mt-4 w-full">
                    <button onClick={() => setCurrentStep(s => Math.max(0, s - 1))} disabled={currentStep === 0} className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="font-semibold text-sky-400">Step {currentStep + 1} of {timeline.length}</span>
                    <button onClick={() => setCurrentStep(s => Math.min(timeline.length - 1, s + 1))} disabled={currentStep === timeline.length - 1} className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>
            <div className="md:w-1/3 p-4 overflow-y-auto border-t md:border-t-0 border-gray-700">
                <h4 className="text-md font-bold mb-3 text-sky-400">Current Step Details</h4>
                <div className="bg-gray-800 p-3 rounded-lg text-sm h-full">
                    {currentLog ? (
                        <>
                            <p className="text-gray-300 font-mono break-words">{currentLog.message}</p>
                            <p className="mt-2 text-xs text-gray-500">Action Type: <span className="text-amber-300">{currentLog.type}</span></p>
                        </>
                    ) : (
                        <p className="text-gray-500">Log detail not available for this specific screenshot.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

interface MetricCardProps {
    title: string;
    value: string | number;
    unit?: string;
    color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, unit, color }) => (
    <div className="bg-gray-700 p-4 rounded-xl shadow-lg border border-gray-600 h-full">
        <p className="text-sm font-medium text-gray-300">{title}</p>
        <p className={`text-2xl font-bold mt-1 ${color || 'text-white'}`}>
            {value}
            {unit && <span className="text-base font-normal ml-1 text-gray-400">{unit}</span>}
        </p>
    </div>
);

// ==================================================================
// Main App Component
// ==================================================================

type RunStatus = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILURE';
type ActiveTab = 'timeline' | 'report' | 'logs';

export default function SyntheticMonitoringPage() {
    const [targetUrl, setTargetUrl] = useState('https://www.google.com');
    const [flowPrompt, setFlowPrompt] = useState('Navigate to the homepage and assert the search bar is visible. Then type "weather" and click the search button.');
    const [runStatus, setRunStatus] = useState<RunStatus>('IDLE');
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<Log[]>([]);
    const [aiReport, setAiReport] = useState('');
    const [screenshotTimeline, setScreenshotTimeline] = useState<string[]>([]);
    const [runTimeMs, setRunTimeMs] = useState(0);
    const [activeTab, setActiveTab] = useState<ActiveTab>('timeline');

    const totalSteps = useMemo(() => logs.filter(l => l.type !== 'INFO').length, [logs]);
    
    const startMonitoring = useCallback(async () => {
        const startTime = Date.now();
        setLoading(true);
        setRunStatus('RUNNING');
        setLogs([]);
        setAiReport('');
        setScreenshotTimeline([]);
        setRunTimeMs(0);
        setActiveTab('logs');

        try {
            setLogs(prev => [...prev, { type: 'INFO', message: `[AI] Resolving prompt into an execution plan...` }]);
            const executionPlan = await resolveFlowPrompt(flowPrompt);
            setLogs(prev => [...prev, { type: 'SUCCESS', message: `[AI] Plan resolved (${executionPlan.length} steps). Executing via proxy...` }]);
            
            const result = await callRemoteAgent(targetUrl, executionPlan);
            const endTime = Date.now();
            
            setLogs(result.logs);
            setRunStatus(result.status);
            setScreenshotTimeline(result.screenshotTimeline || []);
            setRunTimeMs(endTime - startTime);

            setLogs(prev => [...prev, { type: 'INFO', message: 'Generating AI Root Cause Analysis (RCA)...' }]);
            const reportText = await generateAIReasoning(result.status, result.logs);
            setAiReport(reportText);
            setLogs(prev => [...prev, { type: 'SUCCESS', message: 'RCA report generated successfully.' }]);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setRunStatus('FAILURE');
            setLogs(prev => [...prev, { type: 'FAIL', message: `Critical flow error: ${errorMessage}` }]);
            setAiReport(`Failed to run monitoring flow. Check the Logs tab for connection details. Error: ${errorMessage}`);
            console.error("Monitoring flow failed:", error);
        } finally {
            setLoading(false);
            setActiveTab('timeline');
        }
    }, [targetUrl, flowPrompt]);

    const handleEnhanceFlow = useCallback(async () => {
        if (!flowPrompt) return;
        setLoading(true);
        setLogs(prev => [...prev, { type: 'INFO', message: 'Enhancing flow prompt using AI...' }]);
        
        try {
            const enhancedText = await enhanceFlowPrompt(flowPrompt);
            if (!enhancedText.startsWith('Error')) {
                setFlowPrompt(enhancedText);
                setLogs(prev => [...prev, { type: 'SUCCESS', message: 'Flow prompt enhanced successfully by AI.' }]);
            } else {
                 setLogs(prev => [...prev, { type: 'FAIL', message: enhancedText }]);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setLogs(prev => [...prev, { type: 'FAIL', message: `Failed to enhance flow: ${message}` }]);
        } finally {
            setLoading(false);
        }
    }, [flowPrompt]);

    const statusClasses: Record<RunStatus, string> = {
        IDLE: 'bg-gray-500',
        RUNNING: 'bg-sky-500 animate-pulse',
        SUCCESS: 'bg-green-500',
        FAILURE: 'bg-red-500',
    };

    const getTabClass = (tab: ActiveTab) => 
        `px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === tab 
                ? 'border-sky-500 text-sky-400 bg-gray-800' 
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
        }`;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8 font-['Inter']">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex justify-between items-end border-b border-gray-800 pb-4">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-500">
                            AI Synthetic Monitoring Dashboard
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Flow execution via Netlify Proxy to OCI Agent
                        </p>
                    </div>
                </header>

                <div className="flex flex-col lg:flex-row gap-8">
                    <div className="lg:w-1/3 flex flex-col space-y-6">
                        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700">
                            <h2 className="text-xl font-semibold mb-4 text-white border-b border-gray-700 pb-2">Execution Inputs</h2>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Target URL</label>
                            <input
                                type="url"
                                value={targetUrl}
                                onChange={(e) => setTargetUrl(e.target.value)}
                                placeholder="e.g., https://example.com"
                                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:ring-sky-500 focus:border-sky-500 mb-4"
                                disabled={loading}
                            />
                            <label className="block text-sm font-medium text-gray-300 mb-1">Synthetic Flow Prompt (Natural Language)</label>
                            <textarea
                                value={flowPrompt}
                                onChange={(e) => setFlowPrompt(e.target.value)}
                                placeholder="e.g., Navigate to the pricing page and click the subscribe button."
                                rows={4}
                                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:ring-sky-500 focus:border-sky-500 resize-none"
                                disabled={loading}
                            />
                            <div className="flex flex-col gap-3 mt-4">
                                <button onClick={handleEnhanceFlow} disabled={loading || !flowPrompt} className={`py-3 rounded-lg font-semibold transition-all duration-200 text-white shadow-lg ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50'}`}>
                                    ✨ Enhance Flow Prompt
                                </button>
                                <button onClick={startMonitoring} disabled={loading || !targetUrl || !flowPrompt} className={`py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-700 focus:ring-4 focus:ring-sky-500 focus:ring-opacity-50'}`}>
                                    {loading ? 'Running Flow...' : 'Run Synthetic Test'}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <MetricCard title="Status" value={runStatus} color={statusClasses[runStatus].replace('bg-', 'text-')} />
                            <MetricCard title="Execution Time" value={(runTimeMs / 1000).toFixed(2)} unit="s" color={runStatus === 'SUCCESS' ? 'text-green-400' : 'text-gray-400'} />
                            <MetricCard title="Steps Executed" value={totalSteps} unit="steps" color={'text-cyan-400'} />
                            <MetricCard title="Timeline Frames" value={screenshotTimeline.length} unit="frames" color={'text-purple-400'} />
                        </div>
                    </div>
                    <div className="lg:w-2/3 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 flex flex-col">
                        <div className="flex border-b border-gray-700 px-4 pt-2">
                            <button className={getTabClass('timeline')} onClick={() => setActiveTab('timeline')} disabled={!screenshotTimeline || screenshotTimeline.length === 0}>Visual Timeline</button>
                            <button className={getTabClass('report')} onClick={() => setActiveTab('report')} disabled={!aiReport}>AI Incident Report</button>
                            <button className={getTabClass('logs')} onClick={() => setActiveTab('logs')}>Raw Agent Logs</button>
                        </div>
                        <div className="flex-grow h-[600px] overflow-hidden">
                            {activeTab === 'timeline' && <TimelineDisplay timeline={screenshotTimeline} logs={logs} />}
                            {activeTab === 'logs' && <LogDisplay logs={logs} loading={loading} />}
                            {activeTab === 'report' && (
                                <div className="h-full bg-gray-950 p-6 rounded-b-lg overflow-y-auto text-gray-300 border border-t-0 border-gray-700">
                                    {aiReport ? (
                                        <>
                                            <h3 className={`text-xl font-semibold mb-3 ${runStatus === 'FAILURE' ? 'text-red-400' : 'text-green-400'}`}>
                                                {runStatus === 'FAILURE' ? 'Failure Root Cause Analysis' : 'Successful Run Summary'}
                                            </h3>
                                            <div className="bg-gray-800 p-4 rounded-lg shadow-inner">
                                                <p className="whitespace-pre-wrap">{aiReport}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-gray-500">Run the flow to generate an AI incident report.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
