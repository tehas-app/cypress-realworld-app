import chalk from "chalk";
import detect from "detect-port";

export const frontendPort = process.env.PORT;
export const backendPort = process.env.VITE_BACKEND_PORT;
// Where the browser calls the API. A preview serves the app and the API on one
// origin, so it builds with VITE_API_URL=/api; everywhere else it is the
// backend on localhost.
export const apiUrl = process.env.VITE_API_URL || `http://localhost:${backendPort}`;

export const getBackendPort = async () => {
  return detect(Number(backendPort))
    .then((_port) => {
      if (Number(backendPort) === _port) {
        console.log(chalk.green(`Backend server running at http://localhost:${backendPort}`));
        return Number(backendPort);
      }

      console.log(
        chalk.red(
          `Failed to start the backend server on port ${backendPort}. \n Starting the backend server on port ${_port}. \n Please update VITE_BACKEND_PORT in the .env file and 'expose.apiUrl' in cypress.config.ts to ${_port}.`
        )
      );
      return _port;
    })
    .catch((err) => {
      console.log(chalk.red(err));
    });
};
