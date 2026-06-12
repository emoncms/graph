<?php
defined('EMONCMS_EXEC') or die('Restricted access');
/*
All Emoncms code is released under the GNU Affero General Public License.
See COPYRIGHT.txt and LICENSE.txt.

---------------------------------------------------------------------
Emoncms - open source energy visualisation
Part of the OpenEnergyMonitor project:
http://openenergymonitor.org
*/

global $path, $session, $settings;

$apikey     = $_GET['apikey']    ?? '';
$feedidsLH  = $_GET['feedidsLH'] ?? '';
$feedidsRH  = $_GET['feedidsRH'] ?? '';
$load_saved = $_GET['load']      ?? '';

$min_feed_interval = 10;
if (isset($settings['feed']['min_feed_interval'])) {
	$min_feed_interval = (int) $settings['feed']['min_feed_interval'];
}
load_js("Lib/js/vue.global.prod-3.5.22.min.js");
load_js("Lib/js/flot-5.1.0.mod.min.js");
load_js("Lib/js/clipboard.js");
load_js("Lib/js/DateTimePicker.js");
load_css("Theme/css/datetimepicker.css");
?>

<style>

/* ==========================================================================
   1. PAGE LAYOUT
   ========================================================================== */
body { background-color: whitesmoke; }
.content-container { max-width: 1150px; }

/* ==========================================================================
   2. GRAPH ERROR STATE
   ========================================================================== */
#placeholder_bound.has-error {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 18px;
	box-sizing: border-box;
}

#placeholder_bound .graph-window-error {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	color: #253040;
	border-radius: 10px;
}

#placeholder_bound .graph-window-error.is-error {
	background: linear-gradient(180deg, #fff5f5 0%, #ffe9e9 100%); color: #7a1d1d;
}

#placeholder_bound .graph-window-error.is-info {
	background-color: rgba(183, 213, 238, 0.3); color: #1f4e75;
}

#placeholder_bound .graph-window-error .graph-window-error-title { font-size: 17px; font-weight: 600; }
#placeholder_bound .graph-window-error .graph-window-error-actions { display: flex; justify-content: center; }
#placeholder_bound .graph-window-error .graph-window-error-actions .btn { margin: 0; }

/* ==========================================================================
   3. GRAPH VIEW SHELL
   ========================================================================== */
#graph-view-app { padding-top: 1rem; }

/* ==========================================================================
   4. FEEDS OPTIONS & STATS TABLES
   ========================================================================== */
#tables { overflow-x: auto; overflow-y: visible; }

#feed-options-table { table-layout: auto; min-width: 700px; }

/* Allow the feeds card to scroll horizontally; .card's global overflow:hidden clips #tables otherwise */
.feed-options .card { overflow-x: auto; }

#feed-options-table input,
#feed-options-table select { margin-bottom: 0; }

#feed-stats-table {
	display: grid;
	grid-template-columns: 1fr repeat(7, max-content);
	font-family: var(--font-mono);
	font-size: 13px;
	color: var(--text-secondary);
}

#feed-stats-table thead,
#feed-stats-table tbody,
#feed-stats-table tr { display: contents; }

#feed-stats-table th,
#feed-stats-table td { white-space: nowrap; padding: 4px clamp(6px, 1.2vw, 25px); }

#feed-stats-table td:first-child,
#feed-stats-table th:first-child { white-space: normal; }

.feed-options { overflow-x: auto; }

.graph-section-switcher {
	display: flex;
	width: 100%;
	justify-content: center;
}

.graph-section-switcher .btn-group {
	display: inline-flex;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.graph-section-switcher .btn {
	display: inline-flex;
	align-items: center;
	gap: 0.45rem;
	padding-inline: 1rem;
}

.graph-section-switcher .btn.active {
	background: var(--accent);
	border-color: var(--accent);
	color: #fff;
	box-shadow: none;
}

.graph-section-switcher .btn i {
	margin-top: -1px;
}

#feed-options-table td input[type="checkbox"],
#feed-stats-table td input[type="checkbox"] {
	vertical-align: middle;
	margin: 0;
	position: relative;
	top: -1px;
}

/* ==========================================================================
   5. GRAPH LEGEND, TOOLTIP & NAV BUTTONS
   ========================================================================== */
#tooltip { z-index: 1001; }

#legend {
	width: 100%;
	float: right;
	position: relative;
	z-index: 2;
	font-size: 12px;
}

#legend .col { position: absolute; top: 0; }

#legend .right { right: 0.8em; }

#legend .left { left: 0; }

.legendLayer rect.background { fill: rgba(255, 255, 255, 0.6); }

.legend { font-size: 14px; }

/* Keep touch gestures inside the plot so pan/pinch feels stable on mobile. */
@media (pointer: coarse) {
	#placeholder {
		touch-action: none;
		overscroll-behavior: contain;
	}
}

#graph_zoomin,
#graph_zoomout,
#graph_left,
#graph_right {
	font-weight: 700;
}

/* ==========================================================================
   6. TOP CONTROLS LAYOUT
   ========================================================================== */
#showcontrols { gap: 0.75rem; margin-left: auto; }

.time-manual-controls .input-prepend.input-append,
.time-manual-controls date-time-picker,
.time-manual-controls .dtp-wrap,
.time-manual-controls .dtp-input-wrap {
	flex: 0 0 auto;
	width: auto;
	max-width: none;
}

.time-manual-controls .dtp-input {
	width: 155px;
	min-width: 155px;
	max-width: 155px;
}

.ctrl-checkbox { gap: 0.35rem; }

.ctrl-checkbox input[type="checkbox"] {
	margin: 0;
	position: relative;
	top: -1px;
}

.controls-row-top { align-items: flex-start; }

.controls-row-top .interval-controls { flex: 1 1 0; }

.controls-row-top .axes-controls {
	flex: 1 1 0;
	display: flex;
	justify-content: flex-end;
	align-items: flex-start;
	gap: 0.5rem;
	flex-wrap: wrap;
}

/* ==========================================================================
   7. INTERVAL MODE OPTIONS
   ========================================================================== */
.interval-options-row { gap: 0.5rem; }

.interval-toggle-grid {
	gap: 0.75rem;
	align-items: center;
	flex-wrap: nowrap;
}


.interval-toggle-item.interval-toggle-item-fill {
	flex: 1 1 auto;
	min-width: 0;
}

.interval-toggle-item {
	flex: 0 0 auto;
	justify-content: flex-start;
	gap: 0.5rem;
}

.interval-toggle-item-end {
	margin-left: auto;
	justify-content: flex-end;
}

.interval-toggle-item input[type="checkbox"] { margin: 0; }

.interval-toggle-check { gap: 0.5rem; }

.interval-max-fill {
	display: inline-flex;
	align-items: center;
	margin-left: 0.5rem;
}

.interval-input-auto {
	cursor: pointer;
	background-color: #e9ecef;
	color: #555;
}

/* ==========================================================================
   8. MOBILE ADJUSTMENTS
   ========================================================================== */

@media (max-width: 768px) {
	#graph-view-app { padding-top: 0.2rem; }

	/* Keep interval + axes on same row, wrap if needed */
	.controls-row-top { flex-wrap: wrap; align-items: center; }

	.controls-row-top .interval-controls { flex: 1 1 auto; justify-content: flex-start; }

	.controls-row-top .axes-controls { flex: 0 1 auto; justify-content: flex-start; }

	/* card-controls slightly tighter on mobile */
	.card-controls { padding: 0.5rem 0.6rem; }

	/* Keep manual date range pickers from stretching unexpectedly on small screens */
	.time-manual-controls {
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.time-manual-controls .dtp-input {
		-webkit-text-size-adjust: 100%;
		text-size-adjust: 100%;
	}

	/* Fill nulls + show gaps on same line */
	.interval-toggle-grid {
		flex-direction: row;
		align-items: center;
		flex-wrap: nowrap;
		gap: 0.5rem 1rem;
	}

	.interval-toggle-grid.is-expanded { flex-wrap: wrap; }

	.interval-options-row { gap: 0.35rem; }

	.interval-toggle-item {
		flex: 0 0 auto;
		justify-content: flex-start;
		gap: 0.35rem;
		flex-wrap: nowrap;
	}

	.interval-toggle-item.interval-toggle-item-fill { flex: 1 1 auto; }

	.interval-toggle-grid.is-expanded .interval-toggle-item.interval-toggle-item-fill { flex-basis: 100%; }

	.interval-toggle-check,
	.interval-toggle-grid .ctrl-checkbox,
	.interval-toggle-item-end {
		white-space: nowrap;
	}

	.interval-toggle-item-end { justify-content: flex-start; }

	.interval-toggle-item-end { margin-left: 0; }

	.interval-max-fill { margin-left: 0; }
}

/* ==========================================================================
   9. AXIS, WINDOW INFO & CSV CONTROLS
   ========================================================================== */
.yaxis-minmax { width: 50px !important; }

.csvoptions { width: auto; }

.window-info {
	font-size: var(--font-sm);
	color: var(--text-secondary);
	margin: 0.2rem 0 0;
}

/* ==========================================================================
   10. SIDEBAR: SAVED GRAPHS PANEL
   ========================================================================== */
#my_graphs {
	width: 13rem;
	overflow: hidden;
	position: relative;
}

#my_graphs h4 a { color: var(--l2-title); }
#my_graphs h4 a:hover { text-decoration: underline; }
#my_graphs h5 { color: var(--l2-title); }
#my_graphs input { width: 12rem; }
#my_graphs select { width: 13rem; }

/* ==========================================================================
   11. SIDEBAR: FEED SELECTOR TABLE
   ========================================================================== */

#feed-selector thead th {
    border-top: 2px solid var(--bg-l2);
	font-weight: normal !important;
	color: var(--l2-title);
	cursor: pointer;
	transition: all .3s ease-in;
	padding-left: 0;
}

#feed-selector thead th:hover { color: var(--l2-text); text-decoration: underline; }

#feed-selector input[type="checkbox"] { margin: 0; }

#feed-selector tbody tr > * { border-color: var(--bg-l2); }

#feed-selector tbody tr th {
	cursor: pointer;
	transition: all .3s ease-in;
	font-weight: normal;
}

#feed-selector tbody tr th:hover { text-decoration: underline; }

#feed-selector tbody tr th.feed-title span { max-width: 9em; }

#feed-selector .caret {
	border-top-color: currentColor !important;
	display: inline-block;
	vertical-align: middle;
	margin-right: .4em;
}

/* ==========================================================================
   12. EDITOR SECTION
   ========================================================================== */
.editor-section .editor-note {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	margin: 0 0 1.5rem;
	padding: 0.5rem 0.8rem;
	font-size: var(--font-sm);
	color: var(--text-secondary);
	background: rgba(240, 173, 78, 0.08);
	border-left: 3px solid #f0ad4e;
	border-radius: 4px;
}

.editor-section .editor-note i { color: #f0ad4e; }

.editor-section .editor-block { margin-bottom: 1.5rem; }
.editor-section .editor-block:last-child { margin-bottom: 0; }

.editor-section .editor-block + .editor-block {
	border-top: 1px solid var(--border);
	padding-top: 1.5rem;
}

.editor-section .editor-heading {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	margin: 0 0 0.85rem;
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: var(--text-secondary);
}

.editor-section .editor-heading .icon-question-sign {
	font-size: 13px;
	opacity: 0.65;
}

.editor-section .editor-hint,
.editor-section .editor-status {
	font-size: var(--font-sm);
	color: var(--text-secondary);
	margin: 0.4rem 0 0;
}

.editor-section .editor-table { width: auto; border-collapse: separate; border-spacing: 0 5px; }

.editor-section .editor-table td {
	padding: 3px 14px 3px 0;
	vertical-align: middle;
	border: none;
}

.editor-section .editor-table td:first-child { padding-left: 0.25rem; }

.editor-section .editor-feed-name { font-weight: 600; white-space: nowrap; }

.editor-section .editor-point-row input,
.editor-section .editor-multiply-input { font-family: var(--font-mono); margin-bottom: 0; }

.editor-section .editor-multiply-input { width: 210px; }

.editor-section .editor-multiply-input:disabled { cursor: not-allowed; opacity: 0.6; }

.editor-section .editor-table .btn { margin-bottom: 0; }

.editor-section .editor-table .editor-status { margin: 0; font-style: italic; }

.editor-section .editor-point-row { gap: 0.75rem; flex-wrap: wrap; }
.editor-section .editor-point-row .editor-status { margin: 0; }

</style>

<div id="graph-view-app">
	<!-- ── Graph card ─────────────────────────────────────────────── -->
	<div class="card mt-2">

		<nav class="card-header">
			<div class="card-name">
				<span class="svg-icon-show_chart_bold text-accent" style="color: var(--accent)"></span>&nbsp;
				<?php echo tr('Data viewer'); ?>
			</div>
			<button class="btn" v-if="histogramMode" @click="onHistogramBackClick"><?php echo tr('Back to main view'); ?></button>
		</nav>

		<!-- Normal navigation controls -->
		<div class="card-header" v-show="!histogramMode && !showTimeManual" style="background-color: #eee;">
			<div class="input-prepend input-append my-0">
				<button class="btn graph_time_refresh" title="<?php echo tr('Refresh'); ?>" @click="onGraphTimeRefresh"><i class="icon-repeat"></i></button>
				<select class="btn graph_time my-0" v-model="graphTimeHours" @change="onGraphTimeRefresh" style="width:auto;">
					<option value="1"><?php echo tr('1 hour'); ?></option>
					<option value="6"><?php echo tr('6 hours'); ?></option>
					<option value="12"><?php echo tr('12 hours'); ?></option>
					<option value="24"><?php echo tr('24 hours'); ?></option>
					<option value="168"><?php echo tr('1 Week'); ?></option>
					<option value="336"><?php echo tr('2 Weeks'); ?></option>
					<option value="720"><?php echo tr('Month'); ?></option>
					<option value="8760"><?php echo tr('Year'); ?></option>
					<option value="43800"><?php echo tr('5 Years'); ?></option>
				</select>
			</div>

			<button class="btn my-0 ml-1" title="<?php echo tr('Select time window'); ?>" @click="showTimeManual = true"><i class="icon-resize-horizontal"></i></button>

			<div class="btn-group my-0 ml-1">
				<button class="btn px-3" id="graph_zoomin" title="<?php echo tr('Zoom In'); ?>" @click="onZoomIn">+</button>
				<button class="btn px-3" id="graph_zoomout" title="<?php echo tr('Zoom Out'); ?>" @click="onZoomOut">−</button>
				<button class="btn px-3" id="graph_left" title="<?php echo tr('Earlier'); ?>" @click="onPan(-1)"><</button>
				<button class="btn px-3" id="graph_right" title="<?php echo tr('Later'); ?>" @click="onPan(1)">></button>
			</div>

			<div id="showcontrols" class="d-flex align-items-center">
				<label class="ctrl-checkbox d-flex align-items-center m-0"><input type="checkbox" id="showlegend" v-model="state.showlegend"> <?php echo tr('Legend'); ?></label>
			</div>
		</div>

		<!-- Date-time picker controls -->
		<div class="card-header time-manual-controls" v-show="!histogramMode && showTimeManual" style="background-color: #eee;">
			<div class="input-prepend input-append my-0">
				<span class="add-on"><?php echo tr('Start'); ?></span>
				<date-time-picker v-model="startLocal" @change="onReload"></date-time-picker>
			</div>

			<div class="input-prepend input-append my-0">
				<span class="add-on"><?php echo tr('End'); ?></span>
				<date-time-picker v-model="endLocal" @change="onReload"></date-time-picker>
			</div>

			<button class="btn my-0" title="<?php echo tr('Done'); ?>" @click="showTimeManual = false"><i class="icon-ok"></i></button>
		</div>

		<!-- Histogram controls -->
		<div class="card-header" v-show="histogramMode">
			<div class="input-prepend input-append">
				<span class="add-on"><?php echo tr('Type'); ?></span>
				<select v-model="histogramType" @change="drawHistogram">
					<option value="timeatvalue"><?php echo tr('Time at value'); ?></option>
					<option value="kwhatpower"><?php echo tr('kWh at Power'); ?></option>
				</select>
				<span class="add-on"><?php echo tr('Resolution'); ?></span>
				<input type="text" v-model="histogramResolution" @change="drawHistogram">
			</div>
		</div>

		<!-- Graph area -->
		<div class="card-body">
			<div id="legend" v-show="!errorMessage"></div>
			<div id="placeholder_bound" :class="{'has-error': !!errorMessage}" style="width:100%; height:400px;">
				<div id="placeholder" class="w-100 h-100" v-show="!errorMessage"></div>
				<div id="error" class="graph-window-error" :class="errorType==='info' ? 'is-info' : 'is-error'" v-show="errorMessage">
					<div class="graph-window-error-title">{{ errorMessage }}</div>
					<div class="graph-window-error-actions" v-if="errorBadFeedIds.length">
						<button type="button" class="btn" @click="onRemoveMissingFeeds"><?php echo tr('Remove missing'); ?></button>
					</div>
				</div>
			</div>
		</div>
		<div class="card-body" style="border-top: 1px solid var(--border)" v-show="!histogramMode">
			<div id="window-info" class="window-info" v-if="windowInfo">
				<b><?php echo tr('Window'); ?>:</b> {{ windowInfo.start }} <b>&#x2192;</b> {{ windowInfo.end }}
				&nbsp;&middot;&nbsp; <b><?php echo tr('Length'); ?>:</b> {{ windowInfo.length }}
				<span v-if="windowInfo.floating">&nbsp;&middot;&nbsp; <b><?php echo tr('Floating time on'); ?></b></span>
			</div>

		</div>
	<!-- ── Options card ───────────────────────────────────────────── -->

		<div class="card-controls" style="border-top: 1px solid var(--border); background-color: #eee;" v-show="!histogramMode">

			<div class="controls-row controls-row-top d-flex justify-content-between">
				<div class="input-prepend input-append interval-controls d-flex justify-content-start">
					<span class="add-on"><?php echo tr('Type'); ?></span>
					<select id="request-type" v-model="state.mode" @change="onReload" style="width:auto">
						<option value="interval"><?php echo tr('Fixed Interval'); ?></option>
						<option value="daily"><?php echo tr('Daily'); ?></option>
						<option value="weekly"><?php echo tr('Weekly'); ?></option>
						<option value="monthly"><?php echo tr('Monthly'); ?></option>
						<option value="annual"><?php echo tr('Annual'); ?></option>
					</select>

					<input v-show="state.mode==='interval'" id="request-interval" type="text"
						:value="state.fixinterval ? state.interval : state.interval + 's (auto)'"
						:readonly="!state.fixinterval"
						:class="{'interval-input-auto': !state.fixinterval}"
						:title="state.fixinterval ? '' : '<?php echo tr('Click to edit and fix interval'); ?>'"
						@click="onIntervalInputClick"
						@keydown="onIntegerKeydown"
						@change="onIntervalInputChange"
						style="width:90px; text-align:center">
					<button v-show="state.mode==='interval' && state.fixinterval" class="btn add-on" @click="onIntervalResetAuto" title="<?php echo tr('Return to auto interval'); ?>">&#x2715;</button>
				</div>

				<div class="axes-controls">
					<div id="yaxis_left" class="input-prepend input-append mr-2" v-show="leftCount > 0">
						<span class="add-on px-2">L</span>
						<!-- Left Y-axis min -->
						<input class="yaxis-minmax" id="yaxis-min" type="text"
							:value="state.yaxismin === 'auto' ? 'auto' : state.yaxismin"
							:readonly="state.yaxismin === 'auto'"
							:class="{'interval-input-auto': state.yaxismin === 'auto'}"
							:title="state.yaxismin === 'auto' ? '<?php echo tr('Click to set min'); ?>' : ''"
							@click="onYAxisInputClick('left', 'min', $event)"
							@keydown="onDecimalKeydown"
							@change="onYAxisMinMaxChange('left', 'min', $event)">
						<!-- Left Y-axis max -->
						<input class="yaxis-minmax" id="yaxis-max" type="text"
							:value="state.yaxismax === 'auto' ? 'auto' : state.yaxismax"
							:readonly="state.yaxismax === 'auto'"
							:class="{'interval-input-auto': state.yaxismax === 'auto'}"
							:title="state.yaxismax === 'auto' ? '<?php echo tr('Click to set max'); ?>' : ''"
							@click="onYAxisInputClick('left', 'max', $event)"
							@keydown="onDecimalKeydown"
							@change="onYAxisMinMaxChange('left', 'max', $event)">
						<button class="btn add-on" v-show="!leftAxisIsAuto" @click="resetYAxis('left')">&#x2715;</button>
					</div>

					<div id="yaxis_right" class="input-prepend input-append" v-show="rightCount > 0">
						<span class="add-on px-2">R</span>
						<!-- Right Y-axis min -->
						<input class="yaxis-minmax" id="yaxis-min2" type="text"
							:value="state.yaxismin2 === 'auto' ? 'auto' : state.yaxismin2"
							:readonly="state.yaxismin2 === 'auto'"
							:class="{'interval-input-auto': state.yaxismin2 === 'auto'}"
							:title="state.yaxismin2 === 'auto' ? '<?php echo tr('Click to set min'); ?>' : ''"
							@click="onYAxisInputClick('right', 'min', $event)"
							@keydown="onDecimalKeydown"
							@change="onYAxisMinMaxChange('right', 'min', $event)">
						<!-- Right Y-axis max -->
						<input class="yaxis-minmax" id="yaxis-max2" type="text"
							:value="state.yaxismax2 === 'auto' ? 'auto' : state.yaxismax2"
							:readonly="state.yaxismax2 === 'auto'"
							:class="{'interval-input-auto': state.yaxismax2 === 'auto'}"
							:title="state.yaxismax2 === 'auto' ? '<?php echo tr('Click to set max'); ?>' : ''"
							@click="onYAxisInputClick('right', 'max', $event)"
							@keydown="onDecimalKeydown"
							@change="onYAxisMinMaxChange('right', 'max', $event)">
						<button class="btn add-on" v-show="!rightAxisIsAuto" @click="resetYAxis('right')">&#x2715;</button>
					</div>
				</div>
			</div>

			<div class="controls-row interval-options-row d-flex flex-column" v-show="state.mode==='interval'">
				<div class="interval-toggle-grid d-flex" :class="{ 'is-expanded': state.removeNull }">
					<!--
					<label class="interval-toggle-item" for="request-limitinterval">
						<input id="request-limitinterval" type="checkbox" v-model="state.limitinterval">
						<span><?php echo tr('Limit to data interval'); ?></span>
					</label>-->

					<div class="interval-toggle-item interval-toggle-item-fill d-flex align-items-center m-0">
						<label class="interval-toggle-check d-flex align-items-center m-0" for="request-removenull">
							<input id="request-removenull" type="checkbox" class="remove-null" v-model="state.removeNull" @change="onRemoveNullChange">
							<span><?php echo tr('Fill nulls with last value'); ?></span>
						</label>
						<span class="input-prepend input-append interval-max-fill my-0" v-if="state.removeNull">
							<span class="add-on"><?php echo tr('Max fill'); ?></span>
							<input type="text" class="remove-null-max-duration" v-model="state.removeNullMaxDuration" @change="onRemoveNullChange" style="width:50px; text-align:center">
							<span class="add-on"><?php echo tr('seconds'); ?></span>
						</span>
					</div>

					<label class="interval-toggle-item interval-toggle-item-end d-flex align-items-center m-0" for="showmissing"
						:title="anyDeltaEnabled ? '<?php echo tr('Required while delta is enabled'); ?>' : ''">
						<input type="checkbox" id="showmissing" v-model="state.showmissing" :disabled="anyDeltaEnabled">
						<span><?php echo tr('Show gaps'); ?></span>
					</label>

					<label class="interval-toggle-item ctrl-checkbox d-flex align-items-center m-0" for="showtag">
						<input type="checkbox" id="showtag" v-model="state.showtag">
						<span><?php echo tr('Feed tag'); ?></span>
					</label>
				</div>


			</div>

		</div><!-- .card-controls -->
	</div>
	<!-- ── Feeds options & stats ───────────────────────────────────────────── -->




	<div class="card mt-3">
		<div class="card-header">
			<div class="graph-section-switcher" v-show="!histogramMode">
				<div class="btn-group">
					<button class="btn" :class="{active: activeSection === 'config'}" @click="showOptions"><i class="icon-cog"></i> Feed Config</button>
					<button class="btn" :class="{active: activeSection === 'stats'}" @click="showStats"><i class="icon-signal"></i> Feed Stats</button>
					<button class="btn" :class="{active: activeSection === 'csv'}" @click="showCsvSection"><i class="icon-download-alt"></i> CSV Export</button>
					<button v-if="canEdit" class="btn" :class="{active: activeSection === 'editor'}" @click="showEditorSection"><i class="icon-pencil"></i> <?php echo tr('Editor'); ?></button>
				</div>
			</div>
		</div>

		<div class="feed-options" :class="{hide: state.feedlist.length===0 || histogramMode}" v-show="!histogramMode && !state.showcsv && !editorMode">
			<div class="card">
				<div id="tables">
					<table id="feed-options-table" v-show="!state.showStats">
						<colgroup>
							<col style="width:40px">
							<col>
							<col style="width:100px">
							<col style="width:65px">
							<col style="width:55px">
							<col style="width:65px">
							<col style="width:72px">
							<col style="width:72px">
							<col style="width:70px">
							<col style="width:100px">
							<col style="width:50px">
							<col style="width:130px">
						</colgroup>
						<thead>
							<tr>
								<th></th>
								<th><?php echo tr('Feed'); ?></th>
								<th><?php echo tr('Type'); ?></th>
								<th><?php echo tr('Color'); ?></th>
								<th><?php echo tr('Fill'); ?></th>
								<th><?php echo tr('Stack'); ?></th>
								<th style="text-align:center"><?php echo tr('Scale'); ?></th>
								<th style="text-align:center"><?php echo tr('Offset'); ?></th>
								<th style="text-align:center"><?php echo tr('Delta'); ?></th>
								<th style="text-align:center"><?php echo tr('Average'); ?></th>
								<th><?php echo tr('DP'); ?></th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="(feed, z) in state.feedlist" :key="feed.id">
								<td>
									<a v-if="z > 0" @click="moveFeed(z, -1)" title="<?php echo tr('Move up'); ?>" style="cursor:pointer"><i class="icon-arrow-up"></i></a>
									<a v-if="z < state.feedlist.length - 1" @click="moveFeed(z, 1)" title="<?php echo tr('Move down'); ?>" style="cursor:pointer"><i class="icon-arrow-down"></i></a>
								</td>
								<td class="col-primary">{{ feedName(feed) }}</td>
								<td>
									<select style="width:80px" :value="feed.plottype" @change="setPlottype(feed, $event)">
										<option value="lines"><?php echo tr('Lines'); ?></option>
										<option value="bars"><?php echo tr('Bars'); ?></option>
										<option value="points"><?php echo tr('Points'); ?></option>
										<option value="steps"><?php echo tr('Steps'); ?></option>
									</select>
								</td>
								<td><input type="color" style="width:46px" :value="feedColor(feed)" @input="setColor(feed, $event)"></td>
								<td style="text-align:center"><input type="checkbox" :checked="!!feed.fill" @change="setFill(feed, $event)"></td>
								<td style="text-align:center"><input type="checkbox" :checked="!!feed.stack" @change="setStack(feed, $event)"></td>
								<td style="text-align:center"><input type="text" style="width:50px" :value="feed.scale" @change="setScale(feed, $event)"></td>
								<td style="text-align:center"><input type="text" style="width:50px" :value="feed.offset" @change="setOffset(feed, $event)"></td>
								<td style="text-align:center"><input type="checkbox" :checked="!!feed.delta" @change="setDelta(feed, $event)"></td>
								<td style="text-align:center"><input type="checkbox" :checked="!!feed.average" @change="setAverage(feed, $event)"></td>
								<td>
									<select style="width:50px" :value="feed.dp" @change="setDp(feed, $event)">
										<option>0</option>
										<option>1</option>
										<option>2</option>
										<option>3</option>
									</select>
								</td>
								<td style="text-align:center"><button class="histogram btn" @click="onHistogramClick(feed.id)"><?php echo tr('Histogram'); ?></button></td>
							</tr>
						</tbody>
					</table>

					<table v-show="state.showStats" id="feed-stats-table">
						<thead>
							<tr>
								<th><?php echo tr('Feed'); ?></th>
								<th><?php echo tr('Quality'); ?></th>
								<th><?php echo tr('Min'); ?></th>
								<th><?php echo tr('Max'); ?></th>
								<th><?php echo tr('Diff'); ?></th>
								<th><?php echo tr('Mean'); ?></th>
								<th><?php echo tr('Stdev'); ?></th>
								<th><?php echo tr('Wh'); ?></th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="feed in state.feedlist" :key="'stats-'+feed.id">
								<td>{{ feedName(feed) }}</td>
								<td>{{ feed.stats.quality }}% ({{ feed.stats.good }}/{{ feed.stats.total }})</td>
								<td>{{ Number(feed.stats.min).toFixed(feed.dp) }}</td>
								<td>{{ Number(feed.stats.max).toFixed(feed.dp) }}</td>
								<td>{{ Number(feed.stats.diff).toFixed(feed.dp) }}</td>
								<td>{{ Number(feed.stats.mean).toFixed(feed.dp) }}</td>
								<td>{{ Number(feed.stats.stdev).toFixed(feed.dp) }}</td>
								<td>{{ Number(feed.stats.wh).toFixed(1) }}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<div class="card-controls" style="border-top: 1px solid var(--border)" v-show="!histogramMode && state.showcsv">
			<div class="controls-row">
				<div class="input-prepend">
					<span class="add-on csvoptions"><?php echo tr('Time format'); ?>:</span>
					<select id="csvtimeformat" class="csvoptions" v-model="state.csvtimeformat">
						<option value="unix"><?php echo tr('Unix timestamp'); ?></option>
						<option value="seconds"><?php echo tr('Seconds since start'); ?></option>
						<option value="datestr"><?php echo tr('Date-time string'); ?></option>
					</select>
				</div>
				<div class="input-prepend">
					<span class="add-on csvoptions"><?php echo tr('Null values'); ?>:</span>
					<select id="csvnullvalues" class="csvoptions" v-model="state.csvnullvalues">
						<option value="show"><?php echo tr('Show'); ?></option>
						<option value="lastvalue"><?php echo tr('Replace with last value'); ?></option>
						<option value="remove"><?php echo tr('Remove whole line'); ?></option>
					</select>
				</div>
				<div class="input-prepend">
					<span class="add-on csvoptions"><?php echo tr('Headers'); ?>:</span>
					<select id="csvheaders" class="csvoptions" v-model="state.csvheaders">
						<option value="showNameTag"><?php echo tr('Show name and tag'); ?></option>
						<option value="showName"><?php echo tr('Show name'); ?></option>
						<option value="hide"><?php echo tr('Hide'); ?></option>
					</select>
				</div>
				<div class="ctrl-actions">
					<button id="download-csv" class="btn csvoptions" @click="onDownloadCsv"><?php echo tr('Download'); ?></button>
					<button class="btn csvoptions" id="copy-csv" type="button" @click="onCopyCsv"><?php echo tr('Copy'); ?> <i class="icon-share-alt"></i></button>
					<span id="copy-csv-feedback" class="csvoptions"></span>
				</div>
			</div>
			<textarea id="csv" class="w-100" style="height:500px; box-sizing:border-box" v-model="csvText"></textarea>
		</div><!-- .card-controls (csv) -->

		<div class="card-controls editor-section" style="border-top: 1px solid var(--border)" v-show="!histogramMode && editorMode">
			<p class="editor-note">
				<i class="icon-warning-sign"></i>
				<span><?php echo tr('Changes are written directly to the feed and cannot be undone.'); ?></span>
			</p>

			<!-- Individual datapoint editing -->
			<div class="editor-block">
				<h5 class="editor-heading"><?php echo tr('Edit individual datapoint'); ?></h5>
				<div v-if="editPoint" class="editor-point-row d-flex align-items-center">
					<div class="input-prepend input-append my-0">
						<span class="add-on">{{ editPoint.name }}</span>
						<span class="add-on"><?php echo tr('Time'); ?></span>
						<input type="text" v-model="editPoint.time" style="width:110px">
						<span class="add-on"><?php echo tr('Value'); ?></span>
						<input type="text" v-model="editPoint.value" style="width:90px">
						<button class="btn btn-info" @click="onPointSave"><?php echo tr('Save'); ?></button>
						<button class="btn" @click="editPoint = null" title="<?php echo tr('Cancel'); ?>">&#x2715;</button>
					</div>
					<span class="editor-status" v-if="editStatus">{{ editStatus }}</span>
				</div>
				<p v-else class="editor-hint">{{ pointEditHint }}</p>
			</div>

			<!-- Per-feed window multiply -->
			<div class="editor-block">
				<h5 class="editor-heading">
					<?php echo tr('Multiply data in window'); ?>
					<i class="icon icon-question-sign" style="cursor:pointer" title="<?php echo tr('Enter a float (e.g. 2), a fraction (e.g. 1/2), NAN to erase the window to null, or abs(x) to convert to absolute values.'); ?>"></i>
				</h5>
				<table class="editor-table" v-if="state.feedlist.length">
					<tbody>
						<tr v-for="feed in state.feedlist" :key="'edit-'+feed.id">
							<td class="editor-feed-name">{{ feedName(feed) }}</td>
							<td><input type="text" class="editor-multiply-input" v-model="multiplyValues[feed.id]" placeholder="2, 1/2, -1, NAN, abs(x)" :disabled="feedHasScaleOffset(feed)"></td>
							<td><button class="btn btn-info" @click="onMultiplySubmit(feed)" :disabled="feedHasScaleOffset(feed)"><?php echo tr('Save'); ?></button></td>
							<td class="editor-status">{{ feedHasScaleOffset(feed) ? '<?php echo tr('Remove the scale and offset to edit this feed'); ?>' : multiplyStatus[feed.id] }}</td>
						</tr>
					</tbody>
				</table>
				<p v-else class="editor-hint"><?php echo tr('Select one or more feeds to edit.'); ?></p>
			</div>
		</div><!-- .card-controls (editor) -->
	</div>

	<Teleport to=".menu-l3">
		<div class="htop"></div>
		<h3 class="l3-title mx-3"><?php echo tr('Graph'); ?></h3>

		<!-- Feed selector -->
		<table id="feed-selector" class="table table-condensed mx-3" style="width:90%">
			<colgroup>
				<col style="width:70%">
				<col style="width:15%">
				<col style="width:15%">
			</colgroup>
			<template v-for="(tagFeeds, tag) in feedsByTag" :key="tag">
				<thead>
					<tr class="tagheading" tabindex="0" @click="toggleTag(tag)" @keyup.enter="toggleTag(tag)">
						<th colspan="3"><span class="caret"></span>{{ tag }}</th>
					</tr>
				</thead>
				<tbody v-show="!collapsedTags[tag]">
					<tr v-for="feed in tagFeeds" :key="feed.id" style="color:#666">
						<th class="feed-title" tabindex="0"
							@click="toggleFeedLeft(feed.id)" @keyup.enter="toggleFeedLeft(feed.id)">
							<span class="text-truncate d-inline-block">{{ feed.name.length > 20 ? feed.name.substr(0,20)+'..' : feed.name }}</span>
						</th>
						<td><input type="checkbox" :checked="leftChecked.has(feed.id)" @change="onYAxisChange(feed.id, 1, $event.target.checked)"></td>
						<td><input type="checkbox" :checked="rightChecked.has(feed.id)" @change="onYAxisChange(feed.id, 2, $event.target.checked)"></td>
					</tr>
				</tbody>
			</template>
		</table>

		<!-- My Graphs -->
		<div id="my_graphs" class="px-3">
			<h4>
				<a href="#" class="d-block" @click.prevent="savedGraphsCollapsed = !savedGraphsCollapsed">
					<?php echo tr('My Graphs'); ?>
					<span class="arrow arrow-down pull-right"></span>
				</a>
			</h4>
			<div v-if="!savedGraphsCollapsed">
				<select id="graph-select" class="mb-2" v-model="savedGraphSelected">
					<option value="-1"><?php echo tr('Select graph'); ?> :</option>
					<option v-for="(g, i) in savedGraphs" :key="g.id" :value="i">[#{{ g.id }}] {{ g.name }}</option>
				</select>
				<h5><?php echo tr('Graph Name'); ?>:</h5>
				<input id="graphName" class="mb-2" v-model="savedGraphName" type="text" placeholder="<?php echo tr('Graph Name'); ?>" :disabled="!canWriteGraphs">
				<small class="help-block">
					<span v-if="savedGraphSelected > -1"><?php echo tr('Selected graph id'); ?>: {{ savedGraphs[savedGraphSelected].id }}</span>
					<span v-else><?php echo tr('None selected'); ?></span>
				</small>
				<small class="help-block" v-if="savedGraphSelected > -1">
					{{ savedGraphChanged ? '<?php echo tr('Changed'); ?>' : '<?php echo tr('No changes'); ?>' }}
				</small>
				<button class="btn" @click="onDeleteSavedGraph" :disabled="!canWriteGraphs || savedGraphSelected < 0"><?php echo tr('Delete'); ?></button>&nbsp;
				<button class="btn" @click="onSaveSavedGraph" :disabled="!canSaveSavedGraph"><?php echo tr('Save'); ?></button>
				<small class="help-block" v-if="savedGraphStatus">{{ savedGraphStatus }}</small>
			</div>
		</div>
	</Teleport>
</div>

<script>
var path = <?php echo json_encode($path); ?>;
const min_feed_interval = <?php echo $min_feed_interval; ?>;
const apikey = <?php echo json_encode($apikey); ?>;
const apikeystr = apikey !== '' ? '&apikey=' + apikey : '';
const feedidsLH = <?php echo json_encode($feedidsLH); ?>;
const feedidsRH = <?php echo json_encode($feedidsRH); ?>;
const load_savegraphs = <?php echo json_encode($load_saved); ?>;
var session_write = <?php echo isset($session['write']) ? (int) $session['write'] : 0; ?>;
var graphTranslations = {
	'Copied': "<?php echo tr('Copied'); ?>",
	'Copy not supported': "<?php echo tr('Copy not supported'); ?>",
	'Request error': "<?php echo tr('Request error'); ?>",
	'Window': "<?php echo tr('Window'); ?>",
	'Length': "<?php echo tr('Length'); ?>",
	'Please select a feed from the Feeds List': "<?php echo tr('Please select a feed from the Feeds List'); ?>",
	'Remove missing': "<?php echo tr('Remove missing'); ?>",
	'Graph not found': "<?php echo tr('Graph not found'); ?>",
	'Graph Name required': "<?php echo tr('Graph Name required'); ?>",
	'Saved': "<?php echo tr('Saved'); ?>",
	'Deleted': "<?php echo tr('Deleted'); ?>",
	'Click a datapoint on the chart to edit it': "<?php echo tr('Click a datapoint on the chart to edit it'); ?>",
	'Zoom in to the feed interval to edit individual datapoints': "<?php echo tr('Zoom in to the feed interval to edit individual datapoints'); ?>",
	'Switch to Fixed Interval mode to edit individual datapoints': "<?php echo tr('Switch to Fixed Interval mode to edit individual datapoints'); ?>",
	'Editing not available for this datapoint at the current zoom level': "<?php echo tr('Editing not available for this datapoint at the current zoom level'); ?>",
	'Multiply the data shown in the current window? This writes to the feed and cannot be undone.': "<?php echo tr('Multiply the data shown in the current window? This writes to the feed and cannot be undone.'); ?>",
	'Invalid value. Use a float, a fraction (1/2), NAN or abs(x).': "<?php echo tr('Invalid value. Use a float, a fraction (1/2), NAN or abs(x).'); ?>",
	'Enter a value': "<?php echo tr('Enter a value'); ?>",
	'Remove the scale and offset to edit this feed': "<?php echo tr('Remove the scale and offset to edit this feed'); ?>"
};
</script>

<?php load_js("Modules/graph/graph.lib.js"); ?>
<?php load_js("Modules/graph/graph.core.js"); ?>
<script>
// On mobile/tablet viewports, start with both l2 and l3 fully hidden
// so the graph fills the screen without sidebars overlapping content.
if (window.innerWidth < 1150 && typeof menu !== 'undefined') {
    menu.hide_l2();
}
</script>
