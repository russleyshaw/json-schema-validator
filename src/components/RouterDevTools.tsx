import { Suspense, lazy } from "react";
import { IS_DEV_MODE } from "../env";
const DevTools = !IS_DEV_MODE
	? () => null // Render nothing in production
	: lazy(() =>
			// Lazy load in development
			import("@tanstack/router-devtools").then((res) => ({
				default: res.TanStackRouterDevtools,
				// For Embedded Mode
				// default: res.TanStackRouterDevtoolsPanel
			})),
		);

export function RouterDevTools() {
	return (
		<Suspense fallback={null}>
			<DevTools />
		</Suspense>
	);
}
