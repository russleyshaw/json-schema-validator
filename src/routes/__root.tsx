import { Outlet, createRootRoute } from "@tanstack/react-router";
import { RouterDevTools } from "../components/RouterDevTools";

import style from "./rootLayout.module.css";

export const Route = createRootRoute({
	component: () => (
		<div className={style.root}>
			<h1>Russley's JSON Validator</h1>

			<Outlet />

			<RouterDevTools />
		</div>
	),
});
