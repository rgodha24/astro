/* eslint-disable no-console */
// @ts-expect-error
import { loadDevOverlayPlugins } from 'astro:dev-overlay';
import type { DevOverlayPlugin as DevOverlayPluginDefinition } from '../../../@types/astro.js';
import astroDevToolPlugin from './plugins/astro.js';
import astroAuditPlugin from './plugins/audit.js';
import astroXrayPlugin from './plugins/xray.js';
import { DevOverlayCard } from './ui-library/card.js';
import { DevOverlayHighlight } from './ui-library/highlight.js';
import { getIconElement, isDefinedIcon, type Icon } from './ui-library/icons.js';
import { DevOverlayTooltip } from './ui-library/tooltip.js';
import { DevOverlayWindow } from './ui-library/window.js';

type DevOverlayPlugin = DevOverlayPluginDefinition & {
	active: boolean;
	status: 'ready' | 'loading' | 'error';
	eventTarget: EventTarget;
};

document.addEventListener('DOMContentLoaded', async () => {
	const WS_EVENT_NAME = 'astro-dev-overlay';
	const HOVER_DELAY = 750;

	const builtinPlugins: DevOverlayPlugin[] = [
		astroDevToolPlugin,
		astroXrayPlugin,
		astroAuditPlugin,
	].map((plugin) => ({
		...plugin,
		active: false,
		status: 'loading',
		eventTarget: new EventTarget(),
	}));

	const customPluginsImports = (await loadDevOverlayPlugins()) as DevOverlayPluginDefinition[];
	const customPlugins: DevOverlayPlugin[] = [];
	customPlugins.push(
		...customPluginsImports.map((plugin) => ({
			...plugin,
			active: false,
			status: 'loading' as const,
			eventTarget: new EventTarget(),
		}))
	);

	const plugins: DevOverlayPlugin[] = [...builtinPlugins, ...customPlugins];

	for (const plugin of plugins) {
		plugin.eventTarget.addEventListener('plugin-notification', (evt) => {
			const target = overlay.shadowRoot?.querySelector(`[data-plugin-id="${plugin.id}"]`);
			if (!target) return;

			let newState = true;
			if (evt instanceof CustomEvent) {
				newState = evt.detail.state ?? true;
			}

			target.querySelector('.notification')?.toggleAttribute('data-active', newState);
		});
	}

	class AstroDevOverlay extends HTMLElement {
		shadowRoot: ShadowRoot;
		hoverTimeout: number | undefined;
		isHidden: () => boolean = () => this.devOverlay?.hasAttribute('data-hidden') ?? true;
		devOverlay: HTMLDivElement | undefined;

		constructor() {
			super();
			this.shadowRoot = this.attachShadow({ mode: 'open' });
		}

		// connect component
		async connectedCallback() {
			this.shadowRoot.innerHTML = `
    <style>
			#dev-overlay {
				position: fixed;
				bottom: 7.5%;
				left: calc(50% + 32px);
				transform: translate(-50%, 0%);
				z-index: 9999999999;
				display: flex;
				gap: 8px;
				align-items: center;
				transition: bottom 0.2s ease-in-out;
				pointer-events: none;
			}

			#dev-overlay[data-hidden] {
				bottom: -40px;
			}

			#dev-overlay[data-hidden]:hover, #dev-overlay[data-hidden]:focus-within {
				bottom: -35px;
				cursor: pointer;
			}

			#dev-overlay[data-hidden] #minimize-button {
				visibility: hidden;
			}

      #dev-bar {
				height: 56px;
				overflow: hidden;
				pointer-events: auto;

				background: linear-gradient(180deg, #13151A 0%, rgba(19, 21, 26, 0.88) 100%);
				box-shadow: 0px 0px 0px 0px #13151A4D;
				border: 1px solid #343841;
				border-radius: 9999px;
			}

			#dev-bar .item {
				display: flex;
				justify-content: center;
				align-items: center;
				width: 64px;
				border: 0;
				background: transparent;
				color: white;
				font-family: system-ui, sans-serif;
				font-size: 1rem;
				line-height: 1.2;
				white-space: nowrap;
				text-decoration: none;
				padding: 0;
				margin: 0;
				overflow: hidden;
			}

			#dev-bar #bar-container .item:hover, #dev-bar #bar-container .item:focus {
				background: rgba(27, 30, 36, 1);
				cursor: pointer;
				outline-offset: -3px;
			}

			#dev-bar .item:first-of-type {
				border-top-left-radius: 9999px;
				border-bottom-left-radius: 9999px;
			}

			#dev-bar .item:last-of-type {
				border-top-right-radius: 9999px;
				border-bottom-right-radius: 9999px;
			}
			#dev-bar #bar-container .item.active {
				background: rgba(71, 78, 94, 1);
			}

			#dev-bar #bar-container .item.active .notification {
				border-color: rgba(71, 78, 94, 1);
			}

			#dev-bar .item .icon {
				position: relative;
				max-width: 24px;
				max-height: 24px;
				user-select: none;
			}

			#dev-bar .item svg {
				width: 24px;
				height: 24px;
				display: block;
				margin: auto;
			}

			#dev-bar .item .notification {
				display: none;
				position: absolute;
				top: -2px;
				right: 0;
				width: 8px;
				height: 8px;
				border-radius: 9999px;
				border: 1px solid rgba(19, 21, 26, 1);
				background: #B33E66;
			}

			#dev-bar .item .notification[data-active] {
				display: block;
			}

			#dev-bar #bar-container {
				height: 100%;
				display: flex;
			}

			#dev-bar .separator {
				background: rgba(52, 56, 65, 1);
				width: 1px;
			}

			astro-dev-overlay-plugin-canvas {
				position: absolute;
				top: 0;
				left: 0;
			}

			astro-dev-overlay-plugin-canvas:not([data-active]) {
				display: none;
			}

			#minimize-button {
				width: 32px;
				height: 32px;
				background: rgba(255, 255, 255, 0.75);
				border-radius: 9999px;
				display: flex;
				justify-content: center;
				align-items: center;
				opacity: 0;
				transition: opacity 0.2s ease-in-out;
				pointer-events: auto;
				border: 0;
				color: white;
				font-family: system-ui, sans-serif;
				font-size: 1rem;
				line-height: 1.2;
				white-space: nowrap;
				text-decoration: none;
				padding: 0;
				margin: 0;
			}

			#minimize-button:hover, #minimize-button:focus {
				cursor: pointer;
				background: rgba(255, 255, 255, 0.90);
			}

			#minimize-button svg {
				width: 16px;
				height: 16px;
			}

			.sr-only {
				position: absolute;
				width: 1px;
				height: 1px;
				padding: 0;
				margin: -1px;
				overflow: hidden;
				clip: rect(0, 0, 0, 0);
				white-space: nowrap;
				border-width: 0;
			}
    </style>

		<div id="dev-overlay">
			<div id="dev-bar">
				<div id="bar-container">
					${builtinPlugins.map((plugin) => this.getPluginTemplate(plugin)).join('')}
					<div class="separator"></div>
					${customPlugins.map((plugin) => this.getPluginTemplate(plugin)).join('')}
				</div>
			</div>
			<button id="minimize-button">${getIconElement('arrow-down')?.outerHTML}</button>
		</div>`;

			this.devOverlay = this.shadowRoot.querySelector<HTMLDivElement>('#dev-overlay')!;
			this.attachEvents();

			// Init plugin lazily
			if ('requestIdleCallback' in window) {
				window.requestIdleCallback(async () => {
					await this.initAllPlugins();
				});
			} else {
				// Fallback to setTimeout for.. Safari...
				setTimeout(async () => {
					await this.initAllPlugins();
				}, 200);
			}
		}

		attachEvents() {
			const items = this.shadowRoot.querySelectorAll<HTMLDivElement>('.item');
			items.forEach((item) => {
				item.addEventListener('click', async (e) => {
					const target = e.currentTarget;
					if (!target || !(target instanceof HTMLElement)) return;

					const id = target.dataset.pluginId;
					if (!id) return;

					const plugin = this.getPluginById(id);
					if (!plugin) return;

					if (plugin.status === 'loading') {
						await this.initPlugin(plugin);
					}

					this.togglePluginStatus(plugin);
				});
			});

			const minimizeButton = this.shadowRoot.querySelector<HTMLDivElement>('#minimize-button');
			if (minimizeButton && this.devOverlay) {
				minimizeButton.addEventListener('click', () => {
					this.toggleOverlay(false);
					this.toggleMinimizeButton(false);
				});
			}

			const devBar = this.shadowRoot.querySelector<HTMLDivElement>('#dev-bar');
			if (devBar) {
				// On hover:
				// - If the overlay is hidden, show it after the hover delay
				// - If the overlay is visible, show the minimize button after the hover delay
				(['mouseenter', 'focusin'] as const).forEach((event) => {
					devBar.addEventListener(event, () => {
						if (this.hoverTimeout) {
							window.clearTimeout(this.hoverTimeout);
						}

						if (this.isHidden()) {
							this.hoverTimeout = window.setTimeout(() => {
								this.toggleOverlay(true);
							}, HOVER_DELAY);
						} else {
							this.hoverTimeout = window.setTimeout(() => {
								this.toggleMinimizeButton(true);
							}, HOVER_DELAY);
						}
					});
				});

				// On unhover:
				// - Reset every timeout, as to avoid showing the overlay/minimize button when the user didn't really want to hover
				// - If the overlay is visible, hide the minimize button after the hover delay
				devBar.addEventListener('mouseleave', () => {
					if (this.hoverTimeout) {
						window.clearTimeout(this.hoverTimeout);
					}

					if (!this.isHidden()) {
						this.hoverTimeout = window.setTimeout(() => {
							this.toggleMinimizeButton(false);
						}, HOVER_DELAY);
					}
				});

				// On click, show the overlay if it's hidden, it's likely the user wants to interact with it
				devBar.addEventListener('click', () => {
					if (!this.isHidden()) return;
					this.toggleOverlay(true);
				});

				devBar.addEventListener('keyup', (event) => {
					if (event.code === 'Space' || event.code === 'Enter') {
						if (!this.isHidden()) return;
						this.toggleOverlay(true);
					}
				});
			}
		}

		async initAllPlugins() {
			await Promise.all(
				plugins
					.filter((plugin) => plugin.status === 'loading')
					.map((plugin) => this.initPlugin(plugin))
			);
		}

		async initPlugin(plugin: DevOverlayPlugin) {
			if (plugin.status === 'ready') return;

			const shadowRoot = this.getPluginCanvasById(plugin.id)!.shadowRoot!;

			try {
				console.info(`Initing plugin ${plugin.id}`);
				await plugin.init?.(shadowRoot, plugin.eventTarget);
				plugin.status = 'ready';

				if (import.meta.hot) {
					import.meta.hot.send(`${WS_EVENT_NAME}:${plugin.id}:init`);
				}
			} catch (e) {
				console.error(`Failed to init plugin ${plugin.id}, error: ${e}`);
				plugin.status = 'error';
			}
		}

		getPluginTemplate(plugin: DevOverlayPlugin) {
			return `<button class="item" data-plugin-id="${plugin.id}">
				<div class="icon">${this.getPluginIcon(plugin.icon)}<div class="notification"></div></div>
				<span class="sr-only">${plugin.name}</span>
			</button>`;
		}

		getPluginIcon(icon: Icon) {
			if (isDefinedIcon(icon)) {
				return getIconElement(icon)?.outerHTML;
			}

			return icon;
		}

		getPluginById(id: string) {
			return plugins.find((plugin) => plugin.id === id);
		}

		getPluginCanvasById(id: string) {
			return this.shadowRoot.querySelector(
				`astro-dev-overlay-plugin-canvas[data-plugin-id="${id}"]`
			);
		}

		togglePluginStatus(plugin: DevOverlayPlugin, status?: boolean) {
			plugin.active = status ?? !plugin.active;
			const target = this.shadowRoot.querySelector(`[data-plugin-id="${plugin.id}"]`);
			if (!target) return;
			target.classList.toggle('active', plugin.active);
			this.getPluginCanvasById(plugin.id)?.toggleAttribute('data-active', plugin.active);

			plugin.eventTarget.dispatchEvent(
				new CustomEvent('plugin-toggle', {
					detail: {
						state: plugin.active,
						plugin,
					},
				})
			);

			if (import.meta.hot) {
				import.meta.hot.send(`${WS_EVENT_NAME}:${plugin.id}:toggle`, { state: plugin.active });
			}
		}

		toggleMinimizeButton(newStatus?: boolean) {
			const minimizeButton = this.shadowRoot.querySelector<HTMLDivElement>('#minimize-button');
			if (!minimizeButton) return;

			if (newStatus !== undefined) {
				if (newStatus === true) {
					minimizeButton.removeAttribute('inert');
					minimizeButton.style.opacity = '1';
				} else {
					minimizeButton.setAttribute('inert', '');
					minimizeButton.style.opacity = '0';
				}
			} else {
				minimizeButton.toggleAttribute('inert');
				minimizeButton.style.opacity = minimizeButton.hasAttribute('inert') ? '0' : '1';
			}
		}

		toggleOverlay(newStatus?: boolean) {
			const barContainer = this.shadowRoot.querySelector<HTMLDivElement>('#bar-container');
			const devBar = this.shadowRoot.querySelector<HTMLDivElement>('#dev-bar');

			if (newStatus !== undefined) {
				if (newStatus === true) {
					this.devOverlay?.removeAttribute('data-hidden');
					barContainer?.removeAttribute('inert');
					devBar?.removeAttribute('tabindex');
				} else {
					this.devOverlay?.setAttribute('data-hidden', '');
					barContainer?.setAttribute('inert', '');
					devBar?.setAttribute('tabindex', '0');
				}
			} else {
				this.devOverlay?.toggleAttribute('data-hidden');
				barContainer?.toggleAttribute('inert');
				if (this.isHidden()) {
					devBar?.setAttribute('tabindex', '0');
				} else {
					devBar?.removeAttribute('tabindex');
				}
			}
		}
	}

	class DevOverlayCanvas extends HTMLElement {
		shadowRoot: ShadowRoot;

		constructor() {
			super();
			this.shadowRoot = this.attachShadow({ mode: 'open' });
		}

		// connect component
		async connectedCallback() {
			this.shadowRoot.innerHTML = ``;
		}
	}

	customElements.define('astro-dev-overlay', AstroDevOverlay);
	customElements.define('astro-dev-overlay-window', DevOverlayWindow);
	customElements.define('astro-dev-overlay-plugin-canvas', DevOverlayCanvas);
	customElements.define('astro-dev-overlay-tooltip', DevOverlayTooltip);
	customElements.define('astro-dev-overlay-highlight', DevOverlayHighlight);
	customElements.define('astro-dev-overlay-card', DevOverlayCard);

	const overlay = document.createElement('astro-dev-overlay');
	overlay.style.zIndex = '999999';
	document.body.append(overlay);

	// Create plugin canvases
	plugins.forEach((plugin) => {
		const pluginCanvas = document.createElement('astro-dev-overlay-plugin-canvas');
		pluginCanvas.dataset.pluginId = plugin.id;
		overlay.shadowRoot?.append(pluginCanvas);
	});
});