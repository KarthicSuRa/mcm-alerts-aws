import React, { useState } from 'react';

const stepIconColors = {
  'navigate': 'bg-blue-100 text-blue-600',
  'search': 'bg-indigo-100 text-indigo-600',
  'click': 'bg-yellow-100 text-yellow-600',
  'assert': 'bg-green-100 text-green-600',
};

interface BuilderStepProps {
  icon: string;
  title: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  stepType: keyof typeof stepIconColors;
}

const BuilderStep: React.FC<BuilderStepProps> = ({ icon, title, value, onChange, placeholder, stepType }) => (
  <div className="flex items-start mb-5 last:mb-0">
    <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 ${stepType === 'assert' ? 'rounded-full' : 'rounded-md'} mr-4 ${stepIconColors[stepType]}`}>
        <span className="text-xl">{icon}</span>
    </div>
    <div className="flex-grow">
      <label className="text-gray-500 text-sm font-bold block mb-1">{title}</label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-gray-100 text-gray-800 px-3 py-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
      />
    </div>
  </div>
);

interface IncidentItemProps {
  description: string;
  time: string;
}

const IncidentItem: React.FC<IncidentItemProps> = ({ description, time }) => (
    <div className="flex justify-between items-center py-3">
        <div className="flex items-center">
            <span className="text-red-500 mr-3 text-lg">▲</span>
            <p className="text-sm font-medium text-gray-800">{description}</p>
        </div>
        <p className="text-sm text-gray-500">{time}</p>
    </div>
);

export default function SyntheticTestRunner() {
  const [url, setUrl] = useState('https://www.dieg.com');
  const [searchTerm, setSearchTerm] = useState('shoes');
  const [clickElement, setClickElement] = useState("button[name='add-to-cart']");
  const [assertText, setAssertText] = useState('Order Total');

  const handleRunTest = () => {
    alert(`Starting test with:\nURL: ${url}\nSearch: ${searchTerm}\nClick: ${clickElement}\nAssert: ${assertText}`);
  };

  return (
    <main className="flex-1 md:ml-72 bg-gray-50 text-gray-800 p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Synthetic Monitoring</h1>
        <p className="text-gray-500 mt-1">Create and run user journey tests to ensure your application is working as expected.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* --- Left Column: Builder and Incidents --- */}
        <div className="lg:col-span-1 flex flex-col gap-8">
            {/* --- Journey Builder Card --- */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold">Journey Builder</h2>
              </div>
              <div className="p-6">
                  <BuilderStep
                      icon=""
                      title="1. Navigate to URL"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="Enter the target URL"
                      stepType="navigate"
                  />
                  <BuilderStep
                      icon=""
                      title="2. Search for Product"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Enter a product to search for"
                      stepType="search"
                  />
                  <BuilderStep
                      icon=""
                      title="3. Click an Element"
                      value={clickElement}
                      onChange={(e) => setClickElement(e.target.value)}
                      placeholder="Enter a CSS selector to click"
                      stepType="click"
                  />
                  <BuilderStep
                      icon="✓"
                      title="4. Assert Text is Visible"
                      value={assertText}
                      onChange={(e) => setAssertText(e.target.value)}
                      placeholder="Enter text to verify is visible"
                      stepType="assert"
                  />
                  <button
                      onClick={handleRunTest}
                      className="w-full mt-4 bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-all text-base"
                  >
                      Run Test
                  </button>
              </div>
            </div>

             {/* --- Recent Incidents Card --- */}
             <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold">Recent Incidents</h2>
                </div>
                <div className="p-6">
                    <div className="flex justify-between items-center text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        <span>Description</span>
                        <span>Time</span>
                    </div>
                    <div className="divide-y divide-gray-200">
                        <IncidentItem description="Cart API Failure" time="15:30" />
                        <IncidentItem description="Homepage Slow Load" time="15:30" />
                        <IncidentItem description="Homepage Slow Load" time="14:55" />
                    </div>
                </div>
            </div>
        </div>

        {/* --- Right Column: Live Preview --- */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm h-full">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Live Preview</h2>
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
          </div>
          <div className="p-6">
              <div
                  className="bg-cover bg-center h-[36rem] rounded-lg bg-gray-100 flex flex-col justify-end items-center border border-gray-200 overflow-hidden pb-4"
                  style={{ backgroundImage: 'url(/img/dashboard-screenshot.png)' }}
              >
                  <p className="text-gray-500">Test results will be shown here</p>
              </div>
          </div>
        </div>

      </div>
    </main>
  );
}
