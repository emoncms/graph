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

$apikey = "";
if (isset($_GET['apikey'])) $apikey = $_GET['apikey'];

$min_feed_interval = 10;
if (isset($settings['feed']['min_feed_interval'])) {
	$min_feed_interval = (int) $settings['feed']['min_feed_interval'];
}
?>

<?php
load_css("Modules/graph/style.css");
load_js("Lib/flot-5.1.0.min.js");
load_js("Lib/misc/clipboard.js");
load_js("Lib/moment.min.js");
load_js("Lib/user_locale.js");
load_js("Lib/misc/gettext.js");
load_js("Lib/vue.global.min.js");
?>

<div id="graph-view-app">
	<h3><?php echo tr('Data viewer'); ?></h3>
	<div id="error" style="display:none"></div>

	<div id="navigation" style="padding-bottom:5px;">
		<div class="input-prepend input-append" style="margin-bottom:0 !important">
			<button class="btn graph_time_refresh" title="<?php echo tr('Refresh'); ?>" @click="onGraphTimeRefresh"><i class="icon-repeat"></i></button>
			<select class="btn graph_time" style="width:110px; padding-left:5px" v-model="graphTimeHours" @change="onGraphTimeChange">
				<option value="1"><?php echo tr('1 hour'); ?></option>
				<option value="6"><?php echo tr('6 hours'); ?></option>
				<option value="12"><?php echo tr('12 hours'); ?></option>
				<option value="24"><?php echo tr('24 hours'); ?></option>
				<option value="168"><?php echo tr('1 Week'); ?></option>
				<option value="336"><?php echo tr('2 Weeks'); ?></option>
				<option value="720"><?php echo tr('Month'); ?></option>
				<option value="8760"><?php echo tr('Year'); ?></option>
			</select>

			<button id="graph_zoomin" class="btn" style="min-width:40px" title="<?php echo tr('Zoom In'); ?>" @click="onZoomIn">+</button>
			<button id="graph_zoomout" class="btn" style="min-width:40px" title="<?php echo tr('Zoom Out'); ?>" @click="onZoomOut">-</button>
			<button id="graph_left" class="btn" style="min-width:40px" title="<?php echo tr('Earlier'); ?>" @click="onPanLeft"><</button>
			<button id="graph_right" class="btn" style="min-width:40px" title="<?php echo tr('Later'); ?>" @click="onPanRight">></button>

		</div>
		<div id="showcontrols" class="input-prepend input-append">
			<span class="add-on"><?php echo tr('Show'); ?></span>
			<span class="add-on"><?php echo tr('missing data'); ?>: <input type="checkbox" id="showmissing" style="margin-top:1px" v-model="state.showmissing"></span>
			<span class="add-on"><?php echo tr('legend'); ?>: <input type="checkbox" id="showlegend" style="margin-top:1px" v-model="state.showlegend"></span>
			<span class="add-on"><?php echo tr('feed tag'); ?>: <input type="checkbox" id="showtag" style="margin-top:1px" v-model="state.showtag"></span>
		</div>

		<div style="clear:both"></div>
	</div>

	<div id="histogram-controls" style="padding-bottom:5px; display:none;">
		<div class="input-prepend input-append">
			<span class="add-on" style="width:100px"><b><?php echo tr('Histogram'); ?></b></span>
			<span class="add-on" style="width:75px"><?php echo tr('Type'); ?></span>
			<select id="histogram-type" style="width:150px">
				<option value="timeatvalue"><?php echo tr('Time at value'); ?></option>
				<option value="kwhatpower"><?php echo tr('kWh at Power'); ?></option>
			</select>
			<span class="add-on" style="width:75px"><?php echo tr('Resolution'); ?></span>
			<input id="histogram-resolution" type="text" style="width:60px" value="100">
		</div>

		<button id="histogram-back" class="btn" style="float:right" @click="noop"><?php echo tr('Back to main view'); ?></button>
	</div>

	<div id="legend"></div>
	<div id="placeholder_bound" style="width:100%; height:400px;">
		<div id="placeholder"></div>
	</div>

	<div id="info">
		<div class="info-controls-panel">
		<div class="input-prepend input-append" style="padding-right:5px">
			<span class="add-on" style="width:50px"><?php echo tr('Start'); ?></span>
			<input id="request-start" type="datetime-local" style="width:185px" v-model="startLocal">
		</div>

		<div class="input-prepend input-append" style="padding-right:5px">
			<span class="add-on" style="width:50px"><?php echo tr('End'); ?></span>
			<input id="request-end" type="datetime-local" style="width:185px" v-model="endLocal">
		</div>

		<div class="input-prepend input-append" style="padding-right:5px">
			<span class="add-on" style="width:50px"><?php echo tr('Type'); ?></span>
			<select id="request-type" style="width:130px" v-model="state.mode">
				<option value="interval"><?php echo tr('Fixed Interval'); ?></option>
				<option value="daily"><?php echo tr('Daily'); ?></option>
				<option value="weekly"><?php echo tr('Weekly'); ?></option>
				<option value="monthly"><?php echo tr('Monthly'); ?></option>
				<option value="annual"><?php echo tr('Annual'); ?></option>
			</select>
		</div>

		<div class="input-prepend input-append" style="padding-right:5px">
			<span class="fixed-interval-options" v-show="state.mode==='interval'">
				<input id="request-interval" type="text" style="width:60px" v-model="state.interval" :disabled="state.fixinterval">
				<span class="add-on"><?php echo tr('Fix'); ?> <input id="request-fixinterval" type="checkbox" style="margin-top:1px" v-model="state.fixinterval"></span>
				<span class="add-on"><?php echo tr('Limit to data interval'); ?> <input id="request-limitinterval" type="checkbox" style="margin-top:1px" v-model="state.limitinterval"></span>
			</span>
		</div>

		<div class="info-axis-actions">
			<div id="yaxis_left" class="input-append input-prepend" v-show="state.num_left > 0">
				<span id="yaxis-left" class="add-on"><?php echo tr('Y-axis').' ('.tr('Left').')'; ?>:</span>
				<span class="yaxis-minmax-label add-on"><?php echo tr('min'); ?></span>
				<input class="yaxis-minmax" id="yaxis-min" type="text" v-model="state.yaxismin">
				<span class="yaxis-minmax-label add-on"><?php echo tr('max'); ?></span>
				<input class="yaxis-minmax" id="yaxis-max" type="text" v-model="state.yaxismax">
				<button class="btn reset-yaxis" @click="resetYAxis('left')"><?php echo tr('Reset'); ?></button>
			</div>

			<div id="yaxis_right" class="input-append input-prepend" v-show="state.num_right > 0">
				<span id="yaxis-right" class="add-on"><?php echo tr('Y-axis').' ('.tr('Right').')'; ?>:</span>
				<span class="yaxis-minmax-label add-on"><?php echo tr('min'); ?></span>
				<input class="yaxis-minmax" id="yaxis-min2" type="text" v-model="state.yaxismin2">
				<span class="yaxis-minmax-label add-on"><?php echo tr('max'); ?></span>
				<input class="yaxis-minmax" id="yaxis-max2" type="text" v-model="state.yaxismax2">
				<button class="btn reset-yaxis" @click="resetYAxis('right')"><?php echo tr('Reset'); ?></button>
			</div>

			<button id="reload" class="btn" style="vertical-align:top" @click="onReload"><?php echo tr('Reload'); ?></button>
			<button id="clear" class="btn" style="vertical-align:top" @click="noop"><?php echo tr('Clear All'); ?></button>
		</div>

		<div class="input-prepend input-append">
			<span class="add-on"><?php echo tr('Remove null values'); ?>:</span>
			<span class="add-on"><input type="checkbox" class="remove-null" style="margin-top:3px" v-model="state.removeNull"></span>
			<span class="add-on"><?php echo tr('Max fill length'); ?>:</span>
			<input type="text" class="remove-null-max-duration" style="width:60px" v-model="state.removeNullMaxDuration">
			<span class="add-on"><?php echo tr('s'); ?></span>
		</div>
		</div>

		<div id="window-info"></div><br>

		<div class="feed-options" :class="{hide: state.feedlist.length===0}">
			<div class="group-card" :class="{'tables-collapsed': tablesCollapsed}">
				<div class="group-card-header feed-options-header" @click="toggleTablesCollapsed">
					<span class="group-name feed-options-title"><?php echo tr('Feeds in view'); ?></span>
					<div class="feed-options-show-options btn btn-sm" :class="{hide: !state.showStats}" @click.stop.prevent="showOptions"><?php echo tr('Show options'); ?></div>
					<div class="feed-options-show-stats btn btn-sm" :class="{hide: state.showStats}" @click.stop.prevent="showStats"><?php echo tr('Show statistics'); ?></div>
					<i class="collapse-icon icon-chevron-down"></i>
				</div>

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
								<td class="col-primary" v-html="feedName(feed)"></td>
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
								<td style="text-align:center"><button class="histogram btn" @click="noop"><?php echo tr('Histogram'); ?></button></td>
							</tr>
						</tbody>
					</table>

					<table id="feed-stats-table" v-show="state.showStats">
						<colgroup>
							<col style="width:40px">
							<col>
							<col style="width:155px">
							<col style="width:72px">
							<col style="width:72px">
							<col style="width:65px">
							<col style="width:65px">
							<col style="width:75px">
							<col style="width:65px">
						</colgroup>
						<thead>
							<tr>
								<th></th>
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
								<td></td>
								<td class="col-primary" v-html="feedName(feed)"></td>
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

		<br>

		<div class="input-prepend input-append">
			<button class="btn" id="showcsv" @click="toggleCsv">{{ csvButtonLabel }}</button>
			<span class="add-on csvoptions" v-show="state.showcsv"><?php echo tr('Time format'); ?>:</span>
			<select id="csvtimeformat" class="csvoptions" v-show="state.showcsv" v-model="state.csvtimeformat">
				<option value="unix"><?php echo tr('Unix timestamp'); ?></option>
				<option value="seconds"><?php echo tr('Seconds since start'); ?></option>
				<option value="datestr"><?php echo tr('Date-time string'); ?></option>
			</select>
			<span class="add-on csvoptions" v-show="state.showcsv"><?php echo tr('Null values'); ?>:</span>
			<select id="csvnullvalues" class="csvoptions" v-show="state.showcsv" v-model="state.csvnullvalues">
				<option value="show"><?php echo tr('Show'); ?></option>
				<option value="lastvalue"><?php echo tr('Replace with last value'); ?></option>
				<option value="remove"><?php echo tr('Remove whole line'); ?></option>
			</select>
			<span class="add-on csvoptions" v-show="state.showcsv"><?php echo tr('Headers'); ?>:</span>
			<select id="csvheaders" class="csvoptions" v-show="state.showcsv" v-model="state.csvheaders">
				<option value="showNameTag"><?php echo tr('Show name and tag'); ?></option>
				<option value="showName"><?php echo tr('Show name'); ?></option>
				<option value="hide"><?php echo tr('Hide'); ?></option>
			</select>
		</div>

		<div class="input-prepend">
			<button id="download-csv" class="csvoptions btn" v-show="state.showcsv" @click="noop"><?php echo tr('Download'); ?></button>
		</div>

		<div class="input-append">
			<button class="csvoptions btn" id="copy-csv" type="button" v-show="state.showcsv" @click="noop"><?php echo tr('Copy'); ?> <i class="icon-share-alt"></i></button>
		</div>

		<span id="copy-csv-feedback" class="csvoptions" v-show="state.showcsv"></span>

		<textarea id="csv" style="width:98%; height:500px; margin-top:10px" v-show="state.showcsv" v-model="csvText"></textarea>

		<Teleport to=".menu-l3">
			<div class="htop"></div>
			<h3 class="l3-title mx-3"><?php echo tr('Graph'); ?></h3>

			<!-- Feed selector -->
			<table id="feeds" class="table table-condensed mx-3" style="width:90%">
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
							<td><input type="checkbox" :checked="leftChecked.has(feed.id)" @change="onLeftChange(feed.id, $event.target.checked)"></td>
							<td><input type="checkbox" :checked="rightChecked.has(feed.id)" @change="onRightChange(feed.id, $event.target.checked)"></td>
						</tr>
					</tbody>
				</template>
			</table>

			<!-- My Graphs -->
			<div id="my_graphs" class="px-3">
				<h4>
					<a href="#" @click.prevent="savedGraphsCollapsed = !savedGraphsCollapsed">
						<?php echo tr('My Graphs'); ?>
						<span class="arrow arrow-down pull-right"></span>
					</a>
				</h4>
				<div v-if="!savedGraphsCollapsed">
					<select id="graph-select" v-model="savedGraphSelected" style="width:100%; margin-bottom:8px">
						<option value="-1"><?php echo tr('Select graph'); ?> :</option>
						<option v-for="(g, i) in savedGraphs" :key="g.id" :value="i">[#{{ g.id }}] {{ g.name }}</option>
					</select>
					<h5><?php echo tr('Graph Name'); ?>:</h5>
					<input id="graphName" v-model="savedGraphName" type="text" placeholder="<?php echo tr('Graph Name'); ?>" style="width:100%; margin-bottom:8px">
					<small class="help-block">
						<span v-if="savedGraphSelected > -1"><?php echo tr('Selected graph id'); ?>: {{ savedGraphs[savedGraphSelected].id }}</span>
						<span v-else><?php echo tr('None selected'); ?></span>
					</small>
					<button type="button" class="btn" @click="noop"><?php echo tr('Delete'); ?></button>
					<button type="button" class="btn" @click="noop"><?php echo tr('Save'); ?></button>
				</div>
			</div>
		</Teleport>
		<div class="layout-note"><?php echo tr('Layout scaffold mode: controls use Vue dummy values only.'); ?></div>
	</div>
</div>

<script>
var path = "<?php echo $path; ?>";
var min_feed_interval = <?php echo $min_feed_interval; ?>;
var apikey = "<?php echo $apikey; ?>";
var apikeystr = apikey !== '' ? '&apikey=' + apikey : '';
var session_write = <?php echo isset($session['write']) ? (int) $session['write'] : 0; ?>;
var INTERVAL_LADDER = [1, 5, 10, 15, 20, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 3600, 7200, 10800, 14400, 18000, 21600, 43200, 86400];

const GraphLayoutApp = {
	data: function () {
		return {
			graphTimeHours: "168",
			tablesCollapsed: false,
			startLocal: "2026-04-24T00:00",
			endLocal: "2026-05-01T00:00",
			csvText: "time,solar,house\n1713916800,450,320\n1713917400,520,360",
			collapsedTags: {},
			savedGraphsCollapsed: false,
			savedGraphSelected: -1,
			savedGraphName: '',
			savedGraphs: [],
			feeds: [],
			state: {
				showmissing: true,
				showlegend: true,
				showtag: false,
				floatingtime: 1,
				mode: "interval",
				interval: "60",
				fixinterval: false,
				limitinterval: true,
				num_left: 1,
				num_right: 1,
				yaxismin: "auto",
				yaxismax: "auto",
				yaxismin2: "auto",
				yaxismax2: "auto",
				removeNull: false,
				removeNullMaxDuration: "900",
				showStats: false,
				showcsv: false,
				csvtimeformat: "unix",
				csvnullvalues: "show",
				csvheaders: "showNameTag",
				feedlist: []
			}
		};
	},
	computed: {
		csvButtonLabel: function () {
			return this.state.showcsv ? "<?php echo tr('Hide CSV Output'); ?>" : "<?php echo tr('Show CSV Output'); ?>";
		},
		feedsByTag: function () {
			var result = {};
			for (var i = 0; i < this.feeds.length; i++) {
				var feed = this.feeds[i];
				var tag = feed.tag || 'undefined';
				if (!result[tag]) result[tag] = [];
				result[tag].push(feed);
			}
			return result;
		},
		leftChecked: function () {
			var s = new Set();
			this.state.feedlist.filter(function (f) { return f.yaxis !== 2; }).forEach(function (f) { s.add(f.id); });
			return s;
		},
		rightChecked: function () {
			var s = new Set();
			this.state.feedlist.filter(function (f) { return f.yaxis === 2; }).forEach(function (f) { s.add(f.id); });
			return s;
		}
	},
	watch: {
		'state.showlegend': function () {
			this.renderChart();
		},
		'state.showmissing': function () {
			this.renderChart();
		},
		'state.showtag': function () {
			this.renderChart();
		}
	},
	mounted: function () {
		if (typeof menu !== 'undefined' && menu.show_l3) {
			menu.show_l3();
		}
		this.fetchFeeds();
		this.fetchFeedData();
		this.bindPlotEvents();
		this.onWindowResize();
		window.addEventListener('resize', this.onWindowResize);
	},
	beforeUnmount: function () {
		this.unbindPlotEvents();
		window.removeEventListener('resize', this.onWindowResize);
	},
	methods: {
		noop: function () {},
		msToDatetimeLocal: function (ms) {
			var d = new Date(ms);
			var pad = function (n) { return String(n).padStart(2, '0'); };
			return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
		},
		toMsFromPlotValue: function (value) {
			return value < 1e12 ? value * 1000 : value;
		},
		syncWindowInputs: function (startMs, endMs) {
			this.startLocal = this.msToDatetimeLocal(startMs);
			this.endLocal = this.msToDatetimeLocal(endMs);
		},
		calcIntervalForWindow: function (startMs, endMs) {
			if (this.state.mode !== 'interval') return;
			if (this.state.fixinterval) return;

			var windowSecs = (endMs - startMs) / 1000;
			var raw = windowSecs / 600;
			var minStep = min_feed_interval || 10;
			var chosen = INTERVAL_LADDER[INTERVAL_LADDER.length - 1];
			for (var i = 0; i < INTERVAL_LADDER.length; i++) {
				var step = INTERVAL_LADDER[i];
				if (step >= raw && step >= minStep) {
					chosen = step;
					break;
				}
			}
			this.state.interval = String(chosen);
		},
		setWindowAndReload: function (startMs, endMs, floating) {
			this.state.floatingtime = floating ? 1 : 0;
			this.calcIntervalForWindow(startMs, endMs);
			this.syncWindowInputs(startMs, endMs);
			this.fetchFeedData();
		},
		onGraphTimeChange: function () {
			this.onGraphTimeRefresh();
		},
		onGraphTimeRefresh: function () {
			var hours = Number(this.graphTimeHours) || 168;
			var endMs = Math.round(Date.now() / 1000) * 1000;
			var startMs = endMs - hours * 3600 * 1000;
			this.setWindowAndReload(startMs, endMs, true);
		},
		onZoomOut: function () {
			var range = this.getWindowRange();
			var width = range.endMs - range.startMs;
			var mid = range.startMs + width / 2;
			var newStart = mid - width;
			var newEnd = mid + width;
			this.setWindowAndReload(newStart, newEnd, false);
		},
		onZoomIn: function () {
			var range = this.getWindowRange();
			var width = range.endMs - range.startMs;
			var quarter = width / 4;
			var mid = range.startMs + width / 2;
			var newStart = mid - quarter;
			var newEnd = mid + quarter;
			this.setWindowAndReload(newStart, newEnd, false);
		},
		onPanLeft: function () {
			var range = this.getWindowRange();
			var shift = (range.endMs - range.startMs) * 0.2;
			this.setWindowAndReload(range.startMs - shift, range.endMs - shift, false);
		},
		onPanRight: function () {
			var range = this.getWindowRange();
			var shift = (range.endMs - range.startMs) * 0.2;
			this.setWindowAndReload(range.startMs + shift, range.endMs + shift, false);
		},
		onReload: function () {
			var range = this.getWindowRange();
			this.setWindowAndReload(range.startMs, range.endMs, false);
		},
		bindPlotEvents: function () {
			var self = this;
			var placeholder = document.getElementById('placeholder');
			if (!placeholder) return;

			this._onPlotSelected = function (event) {
				if (!event.detail || !event.detail.length) return;
				var ranges = event.detail[0];
				if (!ranges || !ranges.xaxis) return;
				var startMs = self.toMsFromPlotValue(ranges.xaxis.from);
				var endMs = self.toMsFromPlotValue(ranges.xaxis.to);
				if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) return;
				self.setWindowAndReload(startMs, endMs, false);
			};

			this._onPlotPanOrZoom = function (event) {
				if (!event.detail || !event.detail.length) return;
				var plot = event.detail[0];
				if (!plot || typeof plot.getAxes !== 'function') return;
				var axes = plot.getAxes();
				if (!axes || !axes.xaxis) return;
				var startMs = self.toMsFromPlotValue(axes.xaxis.min);
				var endMs = self.toMsFromPlotValue(axes.xaxis.max);
				if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) return;
				clearTimeout(self._panZoomTimeout);
				self._panZoomTimeout = setTimeout(function () {
					self.setWindowAndReload(startMs, endMs, false);
				}, 250);
			};

			placeholder.addEventListener('plotselected', this._onPlotSelected);
			placeholder.addEventListener('plotpan', this._onPlotPanOrZoom);
			placeholder.addEventListener('plotzoom', this._onPlotPanOrZoom);
		},
		unbindPlotEvents: function () {
			var placeholder = document.getElementById('placeholder');
			if (!placeholder) return;
			if (this._onPlotSelected) placeholder.removeEventListener('plotselected', this._onPlotSelected);
			if (this._onPlotPanOrZoom) {
				placeholder.removeEventListener('plotpan', this._onPlotPanOrZoom);
				placeholder.removeEventListener('plotzoom', this._onPlotPanOrZoom);
			}
			if (this._panZoomTimeout) clearTimeout(this._panZoomTimeout);
		},
		getWindowRange: function () {
			var startMs = Date.parse(this.startLocal);
			var endMs = Date.parse(this.endLocal);
			if (!isFinite(startMs) || !isFinite(endMs) || startMs >= endMs) {
				endMs = Date.now();
				startMs = endMs - (24 * 3600 * 1000);
			}
			return { startMs: startMs, endMs: endMs };
		},
		fetchFeedData: function () {
			var self = this;
			if (!this.state.feedlist.length) {
				this.renderChart();
				return;
			}

			var range = this.getWindowRange();
			var ids = this.state.feedlist.map(function (f) { return f.id; }).join(',');
			var averages = this.state.feedlist.map(function (f) { return f.average || 0; }).join(',');
			var deltas = this.state.feedlist.map(function (f) { return f.delta || 0; }).join(',');
			var interval = this.state.mode !== 'interval'
				? this.state.mode
				: (parseInt(this.state.interval, 10) || 60);

			var params = new URLSearchParams({
				ids: ids,
				start: String(range.startMs),
				end: String(range.endMs),
				interval: String(interval),
				skipmissing: this.state.showmissing ? '0' : '1',
				limitinterval: this.state.limitinterval ? '1' : '0',
				average: averages,
				delta: deltas,
				timeformat: 'unix'
			});
			if (apikey) params.set('apikey', apikey);

			fetch(path + 'feed/data.json?' + params.toString())
				.then(function (r) {
					if (!r.ok) throw new Error('HTTP ' + r.status);
					return r.json();
				})
				.then(function (response) {
					var byFeedId = {};
					if (Array.isArray(response)) {
						for (var i = 0; i < response.length; i++) {
							var item = response[i];
							if (!item) continue;
							byFeedId[String(item.feedid)] = Array.isArray(item.data) ? item.data : [];
						}
					}

					for (var j = 0; j < self.state.feedlist.length; j++) {
						var feed = self.state.feedlist[j];
						feed.data = byFeedId[String(feed.id)] || [];
					}

					self.renderChart();
				})
				.catch(function (err) {
					console.error('Failed to fetch feed data:', err);
				});
		},
		fetchFeeds: function () {
			var self = this;
			var url = path + 'feed/list.json' + (apikey ? '?apikey=' + apikey : '');
			fetch(url)
				.then(function (r) {
					if (!r.ok) throw new Error('HTTP ' + r.status);
					return r.json();
				})
				.then(function (data) {
					if (Array.isArray(data)) self.feeds = data;
				})
				.catch(function (err) {
					console.error('Failed to fetch feed list:', err);
				});
		},
		toggleTag: function (tag) {
			this.collapsedTags[tag] = !this.collapsedTags[tag];
		},
		toggleFeedLeft: function (feedid) {
			this.onLeftChange(feedid, !this.leftChecked.has(feedid));
		},
		onLeftChange: function (feedid, checked) {
			var idx = this.state.feedlist.findIndex(function (f) { return f.id === feedid; });
			if (checked) {
				if (idx === -1) {
					var feed = this.feeds.find(function (f) { return f.id === feedid; });
					if (feed) this.state.feedlist.push(Object.assign({ plottype:'lines', fill:0, stack:0, scale:'1', offset:'0', delta:0, average:0, dp:1, yaxis:1, stats:{}, data:[], autoColor:'' }, feed));
				} else {
					this.state.feedlist[idx].yaxis = 1;
				}
			} else {
				if (idx !== -1) this.state.feedlist.splice(idx, 1);
			}
			this.fetchFeedData();
		},
		onRightChange: function (feedid, checked) {
			var idx = this.state.feedlist.findIndex(function (f) { return f.id === feedid; });
			if (checked) {
				if (idx === -1) {
					var feed = this.feeds.find(function (f) { return f.id === feedid; });
					if (feed) this.state.feedlist.push(Object.assign({ plottype:'lines', fill:0, stack:0, scale:'1', offset:'0', delta:0, average:0, dp:1, yaxis:2, stats:{}, data:[], autoColor:'' }, feed));
				} else {
					this.state.feedlist[idx].yaxis = 2;
				}
			} else {
				if (idx !== -1) this.state.feedlist.splice(idx, 1);
			}
			this.fetchFeedData();
		},
		onWindowResize: function () {
			this.graphResize();
			this.renderChart();
		},
		graphResize: function () {
			var bound = document.getElementById('placeholder_bound');
			var placeholder = document.getElementById('placeholder');
			if (!bound || !placeholder) return;

			var width = bound.clientWidth;
			var height = width * 0.5;
			if (height < 300) height = 300;

			placeholder.style.width = width + 'px';
			bound.style.height = height + 'px';
			placeholder.style.height = height + 'px';
		},
		buildPlotData: function () {
			var plotdata = [];
			for (var i = 0; i < this.state.feedlist.length; i++) {
				var feed = this.state.feedlist[i];
				var data = Array.isArray(feed.data) ? feed.data.slice() : [];
				var scale = parseFloat(feed.scale);
				if (!isFinite(scale)) scale = 1;
				var offset = parseFloat(feed.offset);
				if (!isFinite(offset)) offset = 0;

				if (!this.state.showmissing) {
					data = data.filter(function (pt) { return pt[1] !== null; });
				}

				if (scale !== 1 || offset !== 0) {
					data = data.map(function (pt) {
						var val = Number(pt[1]);
						if (!isFinite(val)) return [pt[0], pt[1]];
						return [pt[0], val * scale + offset];
					});
				}

				var label = '';
				if (this.state.showtag && feed.tag) label += feed.tag + ': ';
				label += feed.name;

				var stacked = !!feed.stack;
				var fillVal = feed.fill ? (stacked ? 1.0 : 0.5) : 0;

				var series = {
					label: label,
					data: data,
					yaxis: feed.yaxis || 1,
					stack: stacked,
					id: feed.id
				};
				if (feed.color) series.color = feed.color;

				if (feed.plottype === 'lines') series.lines = { show: true, fill: fillVal, lineWidth: 2 };
				if (feed.plottype === 'bars') series.bars = { show: true, fill: fillVal, align: 'center', barWidth: 45 * 60 * 1000 };
				if (feed.plottype === 'points') series.points = { show: true, radius: 3 };
				if (feed.plottype === 'steps') series.lines = { show: true, fill: fillVal, steps: true };

				if (!series.lines && !series.bars && !series.points) {
					series.lines = { show: true, fill: fillVal, lineWidth: 2 };
				}

				plotdata.push(series);
			}

			return plotdata;
		},
		renderChart: function () {
			var placeholder = document.getElementById('placeholder');
			var legendEl = document.getElementById('legend');
			if (!placeholder) return;
			this.graphResize();

			var range = this.getWindowRange();
			var startMs = range.startMs;
			var endMs = range.endMs;

			var options = {
				lines: { fill: false, lineWidth: 2 },
				xaxis: {
					mode: 'time',
					timezone: 'browser',
					min: startMs,
					max: endMs,
					monthNames: typeof moment !== 'undefined' ? moment.monthsShort() : null,
					dayNames: typeof moment !== 'undefined' ? moment.weekdaysMin() : null
				},
				yaxes: [
					{},
					{ alignTicksWithAxis: 1, position: 'right' }
				],
				grid: { hoverable: true, clickable: true },
				selection: { mode: 'x', color: '#e8cfac', visualization: 'fill' },
				legend: { show: this.state.showlegend, position: 'nw', container: legendEl || null },
				toggle: { scale: 'visible' },
				touch: { pan: 'x', scale: 'x' }
			};

			if (this.state.yaxismin !== 'auto' && this.state.yaxismin !== '') options.yaxes[0].min = Number(this.state.yaxismin);
			if (this.state.yaxismax !== 'auto' && this.state.yaxismax !== '') options.yaxes[0].max = Number(this.state.yaxismax);
			if (this.state.yaxismin2 !== 'auto' && this.state.yaxismin2 !== '') options.yaxes[1].min = Number(this.state.yaxismin2);
			if (this.state.yaxismax2 !== 'auto' && this.state.yaxismax2 !== '') options.yaxes[1].max = Number(this.state.yaxismax2);

			var plotdata = this.buildPlotData();

			if (window.Flot && typeof window.Flot.plot === 'function') {
				var plot = window.Flot.plot(placeholder, plotdata, options);
				if (plot && typeof plot.getData === 'function') {
					var rendered = plot.getData();
					for (var i = 0; i < rendered.length; i++) {
						var series = rendered[i];
						if (!series) continue;
						for (var j = 0; j < this.state.feedlist.length; j++) {
							var feed = this.state.feedlist[j];
							if (String(feed.id) === String(series.id)) {
								if (!feed.color) {
									feed.autoColor = this.normalizeColor(series.color);
								}
								break;
							}
						}
					}
				}
				return;
			}

			// if (window.jQuery && typeof window.jQuery.plot === 'function') {
			// 	window.jQuery.plot(window.jQuery(placeholder), plotdata, options);
			// }
		},
		toggleTablesCollapsed: function () {
			this.tablesCollapsed = !this.tablesCollapsed;
		},
		showOptions: function () {
			this.state.showStats = false;
		},
		showStats: function () {
			this.state.showStats = true;
		},
		toggleCsv: function () {
			this.state.showcsv = !this.state.showcsv;
		},
		resetYAxis: function (side) {
			if (side === "left") {
				this.state.yaxismin = "auto";
				this.state.yaxismax = "auto";
			}
			if (side === "right") {
				this.state.yaxismin2 = "auto";
				this.state.yaxismax2 = "auto";
			}
		},
		feedName: function (feed) {
			if (this.state.showtag && feed.tag) return feed.tag + "/" + feed.name;
			return feed.name;
		},
		normalizeColor: function (color) {
			if (!color) return '';
			if (typeof color !== 'string') return '';
			if (color.charAt(0) === '#') {
				if (color.length === 4) {
					return '#' + color.charAt(1) + color.charAt(1) + color.charAt(2) + color.charAt(2) + color.charAt(3) + color.charAt(3);
				}
				return color.length === 7 ? color : '';
			}

			var rgb = color.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
			if (rgb) {
				var r = Math.max(0, Math.min(255, parseInt(rgb[1], 10) || 0));
				var g = Math.max(0, Math.min(255, parseInt(rgb[2], 10) || 0));
				var b = Math.max(0, Math.min(255, parseInt(rgb[3], 10) || 0));
				var toHex = function (n) { return n.toString(16).padStart(2, '0'); };
				return '#' + toHex(r) + toHex(g) + toHex(b);
			}

			return '';
		},
		feedColor: function (feed) {
			return this.normalizeColor(feed.color) || this.normalizeColor(feed.autoColor) || '#000000';
		},
		moveFeed: function (index, direction) {
			var next = index + direction;
			if (next < 0 || next >= this.state.feedlist.length) return;
			var tmp = this.state.feedlist[index];
			this.state.feedlist[index] = this.state.feedlist[next];
			this.state.feedlist[next] = tmp;
		},
		setPlottype: function (feed, event) {
			feed.plottype = event.target.value;
			this.renderChart();
		},
		setColor: function (feed, event) {
			feed.color = event.target.value;
			feed.autoColor = event.target.value;
			this.renderChart();
		},
		setFill: function (feed, event) {
			feed.fill = event.target.checked ? 1 : 0;
			this.renderChart();
		},
		setStack: function (feed, event) {
			feed.stack = event.target.checked ? 1 : 0;
			this.renderChart();
		},
		setScale: function (feed, event) {
			feed.scale = event.target.value;
			this.renderChart();
		},
		setOffset: function (feed, event) {
			feed.offset = event.target.value;
			this.renderChart();
		},
		setDelta: function (feed, event) {
			feed.delta = event.target.checked ? 1 : 0;
			this.fetchFeedData();
		},
		setAverage: function (feed, event) {
			feed.average = event.target.checked ? 1 : 0;
			this.fetchFeedData();
		},
		setDp: function (feed, event) {
			feed.dp = Number(event.target.value);
			this.renderChart();
		}
	}
};

Vue.createApp(GraphLayoutApp).mount('#graph-view-app');
</script>
