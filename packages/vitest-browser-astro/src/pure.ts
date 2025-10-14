import { getElementLocatorSelectors } from "@vitest/browser/utils";
import type { RenderOptions, RenderResult } from "./types";

const mountedContainers = new Set<HTMLElement>();

/**
 * Injects HTML with proper script execution for hydration
 * Uses createContextualFragment like Astro's server islands
 */
function setHTMLWithScripts(container: HTMLElement, html: string): void {
	const range = document.createRange();
	range.selectNode(container);
	const fragment = range.createContextualFragment(html);
	container.appendChild(fragment);
}

/**
 * Sets up container elements in the DOM
 */
function setupContainer(
	baseElement?: HTMLElement,
	container?: HTMLElement,
): { container: HTMLElement; baseElement: HTMLElement } {
	if (!baseElement) {
		baseElement = document.body;
	}

	if (!container) {
		container = document.createElement("div");
		baseElement.appendChild(container);
	}

	return { container, baseElement };
}

/**
 * Creates a render result with cleanup and locators
 */
function createRenderResult(
	container: HTMLElement,
	baseElement: HTMLElement,
): RenderResult {
	mountedContainers.add(container);

	const unmount = () => {
		container.innerHTML = "";
		mountedContainers.delete(container);
		if (container.parentNode === document.body) {
			document.body.removeChild(container);
		}
	};

	const debug = (el?: any, maxLength?: number) => {
		const element = el?.element?.() || el || container;
		console.log(element.outerHTML?.substring(0, maxLength || 7000));
	};

	return {
		container,
		baseElement,
		unmount,
		debug,
		...getElementLocatorSelectors(baseElement),
	};
}

/**
 * Injects rendered HTML into the DOM and returns a render result
 * This runs in the browser after the HTML arrives from Node
 */
export function injectHTML(
	html: string,
	options: RenderOptions = {},
): RenderResult {
	const { container, baseElement } = setupContainer(
		options.baseElement,
		options.container,
	);

	setHTMLWithScripts(container, html);

	return createRenderResult(container, baseElement);
}

/**
 * Cleanup function to remove all mounted containers
 */
export async function cleanup(): Promise<void> {
	mountedContainers.forEach((container) => {
		container.innerHTML = "";
		if (container.parentNode === document.body) {
			document.body.removeChild(container);
		}
	});
	mountedContainers.clear();
}
