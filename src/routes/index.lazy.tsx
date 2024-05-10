import { Editor, useMonaco } from "@monaco-editor/react";
import { configureMonacoYaml } from "monaco-yaml";
import YamlWorker from "../monaco/yaml.worker.js?worker";

import { createLazyFileRoute } from "@tanstack/react-router";
import type { AnySchema, ValidateFunction } from "ajv";
import Ajv from "ajv";
import lzstring from "lz-string";
import { autorun, makeAutoObservable } from "mobx";
import { observer } from "mobx-react";
import { Alert, Button, ButtonGroup } from "react-bootstrap";
import Form from "react-bootstrap/Form";
import Autosizer from "react-virtualized-auto-sizer";
import yaml from "yaml";
import { castError } from "../utils/errors";
import { useEffect } from "react";

import editorWorkerUrl from "monaco-editor/esm/vs/editor/editor.worker?url";
import jsonWorkerUrl from "monaco-editor/esm/vs/language/json/json.worker?url";

import style from "./index.module.css";

window.MonacoEnvironment = {
	getWorker(moduleId, label) {
		switch (label) {
			case "editorWorkerService":
				return new Worker(editorWorkerUrl);

			case "json":
				return new Worker(jsonWorkerUrl);

			case "yaml":
				return new YamlWorker();
			default:
				throw new Error(`Unknown label ${label}`);
		}
	},
};

const ajv = new Ajv();

enum InputMode {
	JSON = "json",
	YAML = "yaml",
}

interface SchemaStatus {
	isValid: boolean;
	errors: string[];
	validator: ValidateFunction | null;
}

interface InputStatus {
	isValid: boolean;
	errors: string[];
}

const DEFAULT_SCHEMA: AnySchema = {
	type: "object",
	properties: {
		foo: { type: "integer" },
		bar: { type: "string" },
	},
	required: ["foo"],
	additionalProperties: false,
};

const DEFAULT_DATA = {
	foo: 42,
	bar: "Hello, World!",
};

const searchParams = new URLSearchParams(window.location.search);

let DEFAULT_SCHEMA_TEXT = JSON.stringify(DEFAULT_SCHEMA, null, 2);
try {
	const schemaTextParam = searchParams.get("schemaText");
	if (schemaTextParam) {
		DEFAULT_SCHEMA_TEXT =
			lzstring.decompressFromEncodedURIComponent(schemaTextParam);
	}
} catch (e) {
	console.error(e);
}

const DEFAULT_INPUT_TEXT = JSON.stringify(DEFAULT_DATA, null, 2);

class ViewModel {
	schemaText = DEFAULT_SCHEMA_TEXT;

	inputText = DEFAULT_INPUT_TEXT;
	inputMode: InputMode = InputMode.JSON;

	constructor() {
		makeAutoObservable(this);
	}

	get schemaStatus(): SchemaStatus {
		if (!this.schemaText) {
			return {
				isValid: false,
				errors: ["Schema is empty"],
				validator: null,
			};
		}

		try {
			const schemaJson = JSON.parse(this.schemaText);
			const validator = ajv.compile(schemaJson);

			return {
				isValid: true,
				errors: [],
				validator,
			};
		} catch (e) {
			const err = castError(e);
			return {
				isValid: false,
				errors: [err.message],
				validator: null,
			};
		}
	}

	get inputStatus(): InputStatus {
		if (!this.inputText) {
			return {
				isValid: false,
				errors: ["Input is empty"],
			};
		}

		let data: unknown;
		try {
			if (this.inputMode === InputMode.JSON) {
				data = JSON.parse(this.inputText);
			} else {
				data = yaml.parse(this.inputText);
			}
		} catch (e) {
			const err = castError(e);
			return {
				isValid: false,
				errors: [err.message],
			};
		}

		if (!this.schemaStatus.isValid || !this.schemaStatus.validator) {
			return {
				isValid: false,
				errors: ["Schema is invalid"],
			};
		}

		const result = this.schemaStatus.validator(data);

		return {
			isValid: result,
			errors:
				this.schemaStatus.validator.errors?.map(
					(e) => `${e.schemaPath}: ${e.message}`,
				) ?? [],
		};
	}

	shareSchema() {
		try {
			const url = new URL(window.location.href);

			url.searchParams.set(
				"schemaText",
				lzstring.compressToEncodedURIComponent(this.schemaText),
			);

			window.history.pushState({}, "", url.toString());
		} catch (e) {
			console.error(e);
		}
	}

	formatSchemaText() {
		try {
			const jsonValue = JSON.parse(this.schemaText);
			this.schemaText = JSON.stringify(jsonValue, null, 2);
		} catch (e) {
			console.error(e);
		}
	}

	formatInputText() {
		if (this.inputMode === InputMode.JSON) {
			this.inputText = JSON.stringify(JSON.parse(this.inputText), null, 2);
		} else if (this.inputMode === InputMode.YAML) {
			this.inputText = yaml.stringify(yaml.parse(this.inputText));
		}
	}

	setInputMode(mode: InputMode) {
		try {
			let jsonValue: string;
			if (this.inputMode === InputMode.JSON) {
				jsonValue = JSON.parse(this.inputText);
			} else {
				jsonValue = yaml.parse(this.inputText);
			}

			if (mode === InputMode.JSON) {
				this.inputText = JSON.stringify(jsonValue, null, 2);
			} else {
				this.inputText = yaml.stringify(jsonValue);
			}

			this.inputMode = mode;
		} catch (e) {
			console.error(e);
		}
	}

	setInputText(text: string) {
		this.inputText = text;
	}

	setSchemaText(text: string) {
		this.schemaText = text;
	}
}

const VM = new ViewModel();

const SchemaEditorFileName = "schema-editor";
const InputEditorFileName = "input-editor";

const IndexPage = observer(() => {
	const monaco = useMonaco();

	useEffect(() => {
		const disposer = autorun(() => {
			const { schemaText } = VM;

			if (monaco && schemaText) {
				monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
					validate: true,
					schemas: [
						{
							fileMatch: [SchemaEditorFileName],
							uri: "http://json-schema.org/draft-07/schema",
						},
						{
							fileMatch: [InputEditorFileName],
							schema: JSON.parse(schemaText),
							uri: `file:///${SchemaEditorFileName}`,
						},
					],
				});

				configureMonacoYaml(monaco, {
					validate: true,
					schemas: [
						{
							fileMatch: [InputEditorFileName],
							schema: JSON.parse(schemaText),
							uri: `file:///${SchemaEditorFileName}`,
						},
					],
				});
			}
		});

		return disposer;
	}, [monaco]);

	return (
		<div className={style.mainLayout}>
			<h3 className={style.schemaTitle}>JSON Schema</h3>
			<h3 className={style.inputTitle}>Data</h3>

			<div className={style.schemaControls}>
				<ButtonGroup>
					<Button onClick={() => VM.formatSchemaText()}>Format</Button>
					<Button onClick={() => VM.shareSchema()}>Share</Button>
				</ButtonGroup>
			</div>
			<div className={style.inputControls}>
				<Form.Select
					value={VM.inputMode}
					onChange={(e) => VM.setInputMode(e.target.value as InputMode)}
					aria-label="Default select example"
				>
					<option value="json">JSON</option>
					<option value="yaml">YAML</option>
				</Form.Select>

				<ButtonGroup>
					<Button onClick={() => VM.formatInputText()}>Format</Button>
				</ButtonGroup>
			</div>
			<div className={style.schemaEditor}>
				<div className="grow">
					<Autosizer>
						{({ width, height }) => {
							return (
								<Editor
									path={SchemaEditorFileName}
									value={VM.schemaText}
									height={height}
									width={width}
									language="json"
									onChange={(value) => VM.setSchemaText(value ?? "")}
								/>
							);
						}}
					</Autosizer>
				</div>
				{VM.schemaStatus.isValid && (
					<Alert variant="success">Schema is valid</Alert>
				)}
				{VM.schemaStatus.errors.map((e) => (
					<Alert key={e} variant="danger">
						{e}
					</Alert>
				))}
			</div>

			<div className={style.inputEditor}>
				<div className="grow">
					<Autosizer>
						{({ width, height }) => {
							return (
								<Editor
									path={InputEditorFileName}
									value={VM.inputText}
									height={height}
									width={width}
									language={VM.inputMode === InputMode.JSON ? "json" : "yaml"}
									onChange={(value) => VM.setInputText(value ?? "")}
								/>
							);
						}}
					</Autosizer>
				</div>
				{VM.inputStatus.isValid && (
					<Alert variant="success">Input is valid</Alert>
				)}

				{VM.inputStatus.errors.map((e) => (
					<Alert key={e} variant="danger">
						{e}
					</Alert>
				))}
			</div>
		</div>
	);
});

export const Route = createLazyFileRoute("/")({
	component: IndexPage,
});
