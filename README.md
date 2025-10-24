# MCM Alerts - Comprehensive Monitoring and Alerting Platform

MCM Alerts is a modern, real-time monitoring and alerting platform designed to provide detailed insights into the health and performance of your web services. It features a feature-rich dashboard, geographical visualization of monitoring nodes, user management, and a multi-channel notification system.

## Core Features

*   **Real-time Site Monitoring**: Track the uptime, response time, and overall performance of your websites and APIs.
*   **Interactive Dashboard**: A centralized view of key statistics, recent activity, and incident history using a clean and modern UI built with Tremor.
*   **Geographical Visualization**: An interactive map (powered by Leaflet) displays the status of your monitored sites across different geographical locations.
*   **Powerful Alerting**: Get instant notifications through push notifications via OneSignal when an incident is detected.
*   **User Management**: Secure user authentication and management powered by Amazon Cognito.
*   **Analytics**: In-depth analytics page to understand long-term trends and performance metrics.
*   **Integrations**: Support for webhooks to integrate with third-party services.
*   **Audit & Logging**: Keep track of all important events and actions with a dedicated audit log page.

## Technical Stack

This project is built with a modern, scalable, and maintainable tech stack.

### Frontend

*   **Framework**: [React](https://reactjs.org/) with [Vite](https://vitejs.dev/) for a fast development experience.
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components**: [Tremor](https://www.tremor.so/) for beautiful, easy-to-use charts and UI elements.
*   **Charting**: [Recharts](https://recharts.org/)
*   **Mapping**: [Leaflet](https://leafletjs.com/) & [React-Leaflet](https://react-leaflet.js.org/)
*   **Push Notifications**: [OneSignal](https://onesignal.com/)

### Backend (Serverless)

*   **Framework**: [AWS Serverless Application Model (SAM)](https://aws.amazon.com/serverless/sam/)
*   **Compute**: [AWS Lambda](https://aws.amazon.com/lambda/) (Python)
*   **API**: [Amazon API Gateway](https://aws.amazon.com/api-gateway/) (REST & WebSockets)
*   **Authentication**: [Amazon Cognito](https://aws.amazon.com/cognito/)

## Project Structure

```
.
├── aws/                  # AWS SAM backend source
│   ├── api_handler.py
│   ├── broadcast.py
│   └── template.yaml     # SAM template
├── public/               # Static assets
├── src/                  # Frontend source code
│   ├── components/       # Reusable React components
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Library functions (AWS client, etc.)
│   ├── pages/            # Main pages for the application
│   ├── App.tsx           # Main App component
│   └── index.tsx         # Application entry point
├── package.json
└── vite.config.ts
```

## Getting Started

### Prerequisites

*   Node.js & npm
*   AWS CLI configured with your credentials
*   AWS SAM CLI

### Backend Deployment

1.  Navigate to the `aws` directory:
    ```bash
    cd aws
    ```
2.  Build the SAM application:
    ```bash
    sam build
    ```
3.  Deploy the application to your AWS account. You will be guided through the process.
    ```bash
    sam deploy --guided
    ```
4.  Take note of the API Gateway endpoints and Cognito User Pool ID from the deployment outputs.

### Frontend Setup

1.  Install the dependencies:
    ```bash
    npm install
    ```
2.  Create a `.env.local` file in the root of the project and add the backend configuration obtained from the SAM deployment.
    ```
    VITE_APP_API_URL="your-api-gateway-endpoint"
    VITE_APP_COGNITO_USER_POOL_ID="your-user-pool-id"
    VITE_APP_COGNITO_CLIENT_ID="your-user-pool-client-id"
    VITE_APP_ONESIGNAL_APP_ID="your-onesignal-app-id"
    ```

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in development mode. Open [http://localhost:5173](http://localhost:5173) to view it. The page will reload if you make edits.

### `npm run build`

Builds the app for production to the `dist` folder. It correctly bundles React in production mode and optimizes the build for the best performance.

### `npm run preview`

Serves the locally built production app from the `dist` folder. This is a good way to test the production build before deployment.
