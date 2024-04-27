import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRoute({
	component: () => (
		<div className="root-layout h-full flex flex-col">
			<div className="p-2 flex gap-2">
				<span className="font-bold">Russley's JSON Validator</span>
				<Link to="/" className="[&.active]:font-bold">
					Home
				</Link>
			</div>
			<div className="grow">
				<Outlet />
			</div>
			<TanStackRouterDevtools />
		</div>
	),
});
