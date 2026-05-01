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

$feedidsLH = "";
if (isset($_GET['feedidsLH'])) $feedidsLH = $_GET['feedidsLH'];

$feedidsRH = "";
if (isset($_GET['feedidsRH'])) $feedidsRH = $_GET['feedidsRH'];

$load_saved = "";
if (isset($_GET['load'])) $load_saved = $_GET['load'];

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
		<div class="input-prepend input-append" style="padding-right:5px">
			<span class="add-on" style="width:50px"><?php echo tr('Start'); ?></span>
			<input id="request-start" type="datetime-local" style="width:185px" v-model="startLocal" @change="onReload">
		</div>

		<div class="input-prepend input-append" style="padding-right:5px">
			<span class="add-on" style="width:50px"><?php echo tr('End'); ?></span>
			<input id="request-end" type="datetime-local" style="width:185px" v-model="endLocal" @change="onReload">
		</div>

		<div class="input-prepend input-append" style="padding-right:5px">
			<span class="add-on" style="width:50px"><?php echo tr('Type'); ?></span>
			<select id="request-type" style="width:130px" v-model="state.mode" @change="onReload">
				<option value="interval"><?php echo tr('Fixed Interval'); ?></option>
				<option value="daily"><?php echo tr('Daily'); ?></option>
				<option value="weekly"><?php echo tr('Weekly'); ?></option>
				<option value="monthly"><?php echo tr('Monthly'); ?></option>
				<option value="annual"><?php echo tr('Annual'); ?></option>
			</select>
		</div>

		<div class="input-prepend input-append" style="padding-right:5px">
			<span class="fixed-interval-options" v-show="state.mode==='interval'">
				<input id="request-interval" type="text" style="width:60px" v-model="state.interval" :disabled="state.fixinterval" @change="onReload">
				<span class="add-on"><?php echo tr('Fix'); ?> <input id="request-fixinterval" type="checkbox" style="margin-top:1px" v-model="state.fixinterval"></span>
				<span class="add-on"><?php echo tr('Limit to data interval'); ?> <input id="request-limitinterval" type="checkbox" style="margin-top:1px" v-model="state.limitinterval"></span>
			</span>
		</div>

		<div>
			<div id="yaxis_left" class="input-append input-prepend" v-show="state.num_left > 0">
				<span id="yaxis-left" class="add-on"><?php echo tr('Y-axis').' ('.tr('Left').')'; ?>:</span>
				<span class="yaxis-minmax-label add-on"><?php echo tr('min'); ?></span>
				<input class="yaxis-minmax" id="yaxis-min" type="text" v-model="state.yaxismin" @change="onYAxisBoundsChange">
				<span class="yaxis-minmax-label add-on"><?php echo tr('max'); ?></span>
				<input class="yaxis-minmax" id="yaxis-max" type="text" v-model="state.yaxismax" @change="onYAxisBoundsChange">
				<button class="btn reset-yaxis" @click="resetYAxis('left')"><?php echo tr('Reset'); ?></button>
			</div>
        </div>
        <div>

			<div id="yaxis_right" class="input-append input-prepend" v-show="state.num_right > 0">
				<span id="yaxis-right" class="add-on"><?php echo tr('Y-axis').' ('.tr('Right').')'; ?>:</span>
				<span class="yaxis-minmax-label add-on"><?php echo tr('min'); ?></span>
				<input class="yaxis-minmax" id="yaxis-min2" type="text" v-model="state.yaxismin2" @change="onYAxisBoundsChange">
				<span class="yaxis-minmax-label add-on"><?php echo tr('max'); ?></span>
				<input class="yaxis-minmax" id="yaxis-max2" type="text" v-model="state.yaxismax2" @change="onYAxisBoundsChange">
				<button class="btn reset-yaxis" @click="resetYAxis('right')"><?php echo tr('Reset'); ?></button>
			</div>

		</div>

		<div class="input-prepend input-append" v-show="state.mode==='interval'">
			<span class="add-on"><?php echo tr('Remove null values'); ?>:</span>
			<span class="add-on"><input type="checkbox" class="remove-null" style="margin-top:3px" v-model="state.removeNull" @change="onRemoveNullChange"></span>
			<span class="add-on"><?php echo tr('Max fill length'); ?>:</span>
			<input type="text" class="remove-null-max-duration" style="width:60px" v-model="state.removeNullMaxDuration" @change="onRemoveNullChange">
			<span class="add-on"><?php echo tr('s'); ?></span>
		</div>

		<div id="window-info"></div><br>

		<div class="feed-options" :class="{hide: state.feedlist.length===0}">
			<div class="group-card" :class="{'tables-collapsed': tablesCollapsed}">
				<div class="group-card-header feed-options-header" @click="toggleTablesCollapsed">
					<span class="group-name feed-options-title"><?php echo tr('Feeds in view'); ?></span>

                    <button class="btn" @click="onClearAll"><?php echo tr('Clear All'); ?></button>


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
			<button id="download-csv" class="csvoptions btn" v-show="state.showcsv" @click="onDownloadCsv"><?php echo tr('Download'); ?></button>
		</div>

		<div class="input-append">
			<button class="csvoptions btn" id="copy-csv" type="button" v-show="state.showcsv" @click="onCopyCsv"><?php echo tr('Copy'); ?> <i class="icon-share-alt"></i></button>
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
					<input id="graphName" v-model="savedGraphName" type="text" placeholder="<?php echo tr('Graph Name'); ?>" style="width:100%; margin-bottom:8px" :disabled="!canWriteGraphs">
					<small class="help-block">
						<span v-if="savedGraphSelected > -1"><?php echo tr('Selected graph id'); ?>: {{ savedGraphs[savedGraphSelected].id }}</span>
						<span v-else><?php echo tr('None selected'); ?></span>
					</small>
					<small class="help-block" v-if="savedGraphSelected > -1">
						{{ savedGraphChanged ? '<?php echo tr('Changed'); ?>' : '<?php echo tr('No changes'); ?>' }}
					</small>
					<button type="button" class="btn" @click="onDeleteSavedGraph" :disabled="!canWriteGraphs || savedGraphSelected < 0"><?php echo tr('Delete'); ?></button>
					<button type="button" class="btn" @click="onSaveSavedGraph" :disabled="!canSaveSavedGraph"><?php echo tr('Save'); ?></button>
					<small class="help-block" v-if="savedGraphStatus">{{ savedGraphStatus }}</small>
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
var feedidsLH = "<?php echo $feedidsLH; ?>";
var feedidsRH = "<?php echo $feedidsRH; ?>";
var load_savegraphs = "<?php echo $load_saved; ?>";
var session_write = <?php echo isset($session['write']) ? (int) $session['write'] : 0; ?>;
var INTERVAL_LADDER = [1, 5, 10, 15, 20, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 3600, 7200, 10800, 14400, 18000, 21600, 43200, 86400];

const GraphLayoutApp = {
	data: function () {
		return {
			graphTimeHours: "168",
			tablesCollapsed: false,
			hiddenFeedIds: new Set(),
			startLocal: "2026-04-24T00:00",
			endLocal: "2026-05-01T00:00",
			csvText: "time,solar,house\n1713916800,450,320\n1713917400,520,360",
			collapsedTags: {},
			savedGraphsCollapsed: false,
			savedGraphSelected: -1,
			savedGraphName: '',
			savedGraphs: [],
			savedGraphStatus: '',
			savedGraphStatusTimeout: null,
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
		canWriteGraphs: function () {
			return !!session_write;
		},
		selectedSavedGraph: function () {
			var idx = Number(this.savedGraphSelected);
			if (!isFinite(idx) || idx < 0 || idx >= this.savedGraphs.length) return null;
			return this.savedGraphs[idx] || null;
		},
		savedGraphChanged: function () {
			if (!this.selectedSavedGraph) return false;
			var current = this.normalizeSavedGraphPayload(this.buildSavedGraphPayload());
			var selected = this.normalizeSavedGraphPayload(this.selectedSavedGraph);
			delete current.id;
			delete selected.id;
			return JSON.stringify(current) !== JSON.stringify(selected);
		},
		canSaveSavedGraph: function () {
			if (!this.canWriteGraphs) return false;
			var hasName = this.parseSavedGraphName(this.savedGraphName) !== '';
			if (!hasName) return false;
			if (this.selectedSavedGraph) return this.savedGraphChanged;
			return true;
		},
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
		savedGraphSelected: function (newVal) {
			this.onSavedGraphSelectedChange(newVal);
		},
		'state.showlegend': function () {
			this.renderChart();
		},
		'state.showmissing': function () {
			this.renderChart();
		},
		'state.showtag': function () {
			this.renderChart();
		},
		'state.csvtimeformat': function () {
			this.updateCsvText();
		},
		'state.csvnullvalues': function () {
			this.updateCsvText();
		},
		'state.csvheaders': function () {
			this.updateCsvText();
		}
	},
	mounted: function () {
		if (typeof menu !== 'undefined' && menu.show_l3) {
			menu.show_l3();
		}
		this._onHashChange = this.onSavedHashChange.bind(this);
		window.addEventListener('hashchange', this._onHashChange);
		if (this.canWriteGraphs) {
			this.fetchSavedGraphs();
		}
		this.fetchFeeds();
		this.fetchFeedData();
		this.bindPlotEvents();
		this.onWindowResize();
		window.addEventListener('resize', this.onWindowResize);
	},
	beforeUnmount: function () {
		this.unbindPlotEvents();
		this.removeTooltip();
		if (this._onHashChange) window.removeEventListener('hashchange', this._onHashChange);
		if (this.savedGraphStatusTimeout) clearTimeout(this.savedGraphStatusTimeout);
		window.removeEventListener('resize', this.onWindowResize);
	},
	methods: {
		noop: function () {},
		removeTooltip: function () {
			var existing = document.getElementById('tooltip');
			if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
		},
		showTooltip: function (x, y, contents, bgColor) {
			this.removeTooltip();
			if (!(window.jQuery && typeof window.jQuery === 'function')) return;

			var offset = 15;
			var elem = window.jQuery('<div id="tooltip">' + contents + '</div>').css({
				position: 'absolute',
				display: 'none',
				'font-weight': 'bold',
				border: '1px solid rgb(255, 221, 221)',
				padding: '2px',
				'background-color': bgColor,
				opacity: '0.8'
			}).appendTo('body').fadeIn(200);

			var elemY = y - elem.height() - offset;
			var elemX = x - elem.width() - offset;
			if (elemY < 0) elemY = 0;
			if (elemX < 0) elemX = 0;
			elem.css({ top: elemY, left: elemX });
		},
		getFeedUnit: function (feedid) {
			for (var i = 0; i < this.feeds.length; i++) {
				if (String(this.feeds[i].id) === String(feedid)) {
					return this.feeds[i].unit || '';
				}
			}
			for (var j = 0; j < this.state.feedlist.length; j++) {
				if (String(this.state.feedlist[j].id) === String(feedid)) {
					return this.state.feedlist[j].unit || '';
				}
			}
			return '';
		},
		attachLegendToggle: function (plot) {
			if (!plot || typeof plot.getData !== 'function') return;

			var placeholder = typeof plot.getPlaceholder === 'function' ? plot.getPlaceholder() : null;
			var legendHost = null;
			if (placeholder && placeholder.querySelector) {
				legendHost = placeholder.querySelector('.legend');
			}
			if (!legendHost) {
				var legendContainer = document.getElementById('legend');
				if (legendContainer) {
					legendHost = legendContainer.querySelector('.legend') || legendContainer;
				}
			}
			if (!legendHost) return;

			legendHost.style.pointerEvents = 'auto';
			var series = plot.getData();
			var groups = Array.prototype.slice.call(legendHost.querySelectorAll('svg > g'));
			if (!groups.length) return;

			for (var i = 0; i < groups.length; i++) {
				var group = groups[i];
				var seriesItem = series[i];
				if (!seriesItem) continue;

				var isHidden = this.hiddenFeedIds.has(seriesItem.id);
				group.style.cursor = 'pointer';
				group.style.opacity = isHidden ? '0.4' : '1';

				var fresh = group.cloneNode(true);
				group.parentNode.replaceChild(fresh, group);
				fresh.style.cursor = 'pointer';
				fresh.style.opacity = isHidden ? '0.4' : '1';

				fresh.addEventListener('click', (function (index, vm) {
					return function () {
						var current = plot.getData();
						var currentSeries = current[index];
						if (!currentSeries) return;
						var feed = vm.state.feedlist.find(function (f) {
							return String(f.id) === String(currentSeries.id);
						});
						if (!feed) return;

						var nowHidden = vm.hiddenFeedIds.has(currentSeries.id);
						var show = nowHidden;
						if (nowHidden) vm.hiddenFeedIds.delete(currentSeries.id);
						else vm.hiddenFeedIds.add(currentSeries.id);

						if (currentSeries.lines) {
							var showLines = (feed.plottype === 'lines' || feed.plottype === 'steps') ? show : false;
							currentSeries.lines = Object.assign({}, currentSeries.lines, { show: showLines });
						}
						if (currentSeries.bars) {
							var showBars = feed.plottype === 'bars' ? show : false;
							currentSeries.bars = Object.assign({}, currentSeries.bars, { show: showBars });
						}
						if (currentSeries.points) {
							var showPoints = feed.plottype === 'points' ? show : false;
							currentSeries.points = Object.assign({}, currentSeries.points, { show: showPoints });
						}

						plot.setData(current);
						plot.draw();
						vm.attachLegendToggle(plot);
					};
				})(i, this));
			}
		},
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
		onRemoveNullChange: function () {
			var maxDuration = parseFloat(this.state.removeNullMaxDuration);
			if (!isFinite(maxDuration) || maxDuration <= 0) {
				this.state.removeNullMaxDuration = "900";
			}
			this.renderChart();
		},
		fillShortNullGaps: function (data, intervalSeconds, maxDurationSeconds) {
			var processed = data.map(function (pt) { return [pt[0], pt[1]]; });
			var lastValidPos = 0;
			for (var pos = 0; pos < processed.length; pos++) {
				if (processed[pos][1] !== null) {
					var nullTime = (pos - lastValidPos) * intervalSeconds;
					if (nullTime < maxDurationSeconds) {
						for (var x = lastValidPos + 1; x < pos; x++) {
							processed[x][1] = processed[lastValidPos][1];
						}
					}
					lastValidPos = pos;
				}
			}
			return processed;
		},
		buildProcessedDataForStats: function (feed, intervalSeconds, maxDuration, removeNullEnabled) {
			var data = Array.isArray(feed.data)
				? feed.data.map(function (pt) { return [pt[0], pt[1]]; })
				: [];

			if (removeNullEnabled && data.length > 1) {
				data = this.fillShortNullGaps(data, intervalSeconds, maxDuration);
			}

			var scale = parseFloat(feed.scale);
			if (!isFinite(scale)) scale = 1;
			var offset = parseFloat(feed.offset);
			if (!isFinite(offset)) offset = 0;

			if (scale !== 1 || offset !== 0) {
				data = data.map(function (pt) {
					var val = Number(pt[1]);
					if (!isFinite(val)) return [pt[0], pt[1]];
					return [pt[0], val * scale + offset];
				});
			}

			return data;
		},
		calculateFeedStats: function (data, timeInWindowSeconds) {
			var sum = 0;
			var countValid = 0;
			var npoints = 0;
			var npointsnull = 0;
			var minval = 0;
			var maxval = 0;

			for (var i = 0; i < data.length; i++) {
				var val = data[i][1];
				if (val !== null) {
					if (countValid === 0) {
						minval = val;
						maxval = val;
					}
					if (val > maxval) maxval = val;
					if (val < minval) minval = val;
					sum += val;
					countValid++;
				} else {
					npointsnull++;
				}
				npoints++;
			}

			var mean = countValid > 0 ? sum / countValid : 0;
			var variance = 0;
			var varianceCount = 0;
			for (var j = 0; j < data.length; j++) {
				var v = data[j][1];
				if (v !== null) {
					variance += Math.pow(v - mean, 2);
					varianceCount++;
				}
			}
			var stdev = varianceCount > 0 ? Math.sqrt(variance / varianceCount) : 0;
			var diff = countValid > 0 ? (maxval - minval) : 0;
			var good = npoints - npointsnull;
			var quality = npoints > 0 ? Math.round(100 * (1 - npointsnull / npoints)) : 0;
			var wh = Math.round((mean * timeInWindowSeconds) / 3600);

			return {
				min: minval,
				max: maxval,
				diff: diff,
				mean: mean,
				stdev: stdev,
				quality: quality,
				good: good,
				total: npoints,
				wh: wh
			};
		},
		formatCsvTimestamp: function (timeMs, startTimeMs) {
			if (this.state.csvtimeformat === 'seconds') {
				return Math.round((timeMs - startTimeMs) / 1000);
			}
			if (this.state.csvtimeformat === 'datestr') {
				var t = new Date(timeMs);
				var pad = function (n) { return String(n).padStart(2, '0'); };
				return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes()) + ':' + pad(t.getSeconds());
			}
			return Math.round(timeMs / 1000);
		},
		buildCsvText: function () {
			if (!this.state.feedlist.length) return '';

			var firstFeedData = this.state.feedlist[0].data;
			if (!Array.isArray(firstFeedData) || !firstFeedData.length) return '';

			var nullValues = this.state.csvnullvalues;
			var headers = this.state.csvheaders;
			var showName = headers === 'showNameTag' || headers === 'showName';
			var showTag = headers === 'showNameTag';
			var csvout = '';
			var line = [];
			var values = [];
			var startTime = firstFeedData[0][0];

			if (showName || showTag) {
				if (this.state.csvtimeformat === 'unix') line = ['Unix timestamp'];
				if (this.state.csvtimeformat === 'seconds') line = ['Seconds since start'];
				if (this.state.csvtimeformat === 'datestr') line = ['Date-time string'];

				for (var h = 0; h < this.state.feedlist.length; h++) {
					var headerFeed = this.state.feedlist[h];
					var tagPart = showTag ? (headerFeed.tag || '') : '';
					var namePart = showName ? (headerFeed.name || '') : '';
					line.push(tagPart + (tagPart && namePart ? ':' : '') + namePart);
				}
				csvout = '"' + line.join('", "') + '"\n';
			}

			for (var z = 0; z < firstFeedData.length; z++) {
				line = [this.formatCsvTimestamp(firstFeedData[z][0], startTime)];
				var nullFound = false;

				for (var f = 0; f < this.state.feedlist.length; f++) {
					if (values[f] === undefined) values[f] = null;

					var point = this.state.feedlist[f].data[z];
					if (point === undefined) continue;

					if (point[1] === null) nullFound = true;
					if (point[1] !== null || nullValues === 'show') {
						values[f] = point[1];
					}

					var outVal = values[f];
					if (outVal !== null) {
						var numeric = Number(outVal);
						if (isFinite(numeric)) {
							outVal = numeric.toFixed(this.state.feedlist[f].dp);
						}
					}
					line.push(String(outVal));
				}

				if (nullValues === 'remove' && nullFound) {
					continue;
				}
				csvout += line.join(', ') + '\n';
			}

			return csvout;
		},
		updateCsvText: function () {
			if (!this.state.showcsv) return;
			this.csvText = this.buildCsvText();
		},
		onDownloadCsv: function () {
			if (!this.state.showcsv) return;
			var csv = this.buildCsvText();
			if (!csv) return;
			this.csvText = csv;

			var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
			var url = window.URL.createObjectURL(blob);
			var link = document.createElement('a');
			link.href = url;
			link.download = 'emoncms-graph.csv';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		},
		onCopyCsv: function () {
			if (!this.state.showcsv) return;
			var csv = this.buildCsvText();
			if (!csv) return;
			this.csvText = csv;

			var csvElement = document.getElementById('csv');
			if (typeof copyToClipboardCustomMsg === 'function' && csvElement) {
				copyToClipboardCustomMsg(csvElement, 'copy-csv-feedback', "<?php echo tr('Copied'); ?>", "<?php echo tr('Copy not supported'); ?>");
				return;
			}

			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(csv).then(function () {
					var feedback = document.getElementById('copy-csv-feedback');
					if (!feedback) return;
					feedback.textContent = "<?php echo tr('Copied'); ?>";
					setTimeout(function () { feedback.textContent = ''; }, 2000);
				});
			}
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

			this._onPlotHover = function (event) {
				if (!event.detail || event.detail.length < 2) {
					self.removeTooltip();
					self._previousHoverPoint = null;
					return;
				}

				var item = event.detail[1];
				if (!item) {
					self.removeTooltip();
					self._previousHoverPoint = null;
					return;
				}

				var datapoint = item.datapoint;
				if (!datapoint) {
					self.removeTooltip();
					self._previousHoverPoint = null;
					return;
				}

				var datapointKey = String(datapoint[0]) + ':' + String(datapoint[1]) + ':' + String(datapoint[2]);
				if (datapointKey === self._previousHoverPoint) return;
				self._previousHoverPoint = datapointKey;

				var feed = self.state.feedlist[item.seriesIndex] || null;
				var feedid = feed ? feed.id : null;
				var dp = feed && isFinite(Number(feed.dp)) ? Number(feed.dp) : 0;
				var isStack = typeof datapoint[2] !== 'undefined';
				var raw = isStack ? (datapoint[1] - datapoint[2]) : datapoint[1];
				if (!isFinite(raw)) {
					self.removeTooltip();
					return;
				}

				var value = raw.toFixed(dp) + ' ' + self.getFeedUnit(feedid);
				var date = typeof moment !== 'undefined' ? moment(datapoint[0]).format('llll') : new Date(datapoint[0]).toString();
				var ts = datapoint[0] / 1000;

				self.showTooltip(
					item.pageX,
					item.pageY,
					'<span style="font-size:11px">' + item.series.label + '</span><br>' + value + '<br>' +
					'<span style="font-size:11px">' + date + '</span><br><span style="font-size:11px">(' + ts + ')</span>',
					'#fff'
				);
			};

			placeholder.addEventListener('plotselected', this._onPlotSelected);
			placeholder.addEventListener('plotpan', this._onPlotPanOrZoom);
			placeholder.addEventListener('plotzoom', this._onPlotPanOrZoom);
			placeholder.addEventListener('plothover', this._onPlotHover);
		},
		unbindPlotEvents: function () {
			var placeholder = document.getElementById('placeholder');
			if (!placeholder) return;
			if (this._onPlotSelected) placeholder.removeEventListener('plotselected', this._onPlotSelected);
			if (this._onPlotPanOrZoom) {
				placeholder.removeEventListener('plotpan', this._onPlotPanOrZoom);
				placeholder.removeEventListener('plotzoom', this._onPlotPanOrZoom);
			}
			if (this._onPlotHover) {
				placeholder.removeEventListener('plothover', this._onPlotHover);
			}
			if (this._panZoomTimeout) clearTimeout(this._panZoomTimeout);
			this.removeTooltip();
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
					if (!Array.isArray(data)) return;
					self.feeds = data;
					if (!load_savegraphs) self.applyUrlFeedSelection();
				})
				.catch(function (err) {
					console.error('Failed to fetch feed list:', err);
				});
		},
		showSavedGraphStatus: function (message) {
			this.savedGraphStatus = message;
			if (this.savedGraphStatusTimeout) {
				clearTimeout(this.savedGraphStatusTimeout);
			}
			var self = this;
			this.savedGraphStatusTimeout = setTimeout(function () {
				self.savedGraphStatus = '';
			}, 2000);
		},
		getSavedHashId: function () {
			var hash = String(window.location.hash || '');
			if (hash.indexOf('#/Saved/') !== 0) return '';
			return hash.replace('#/Saved/', '').trim();
		},
		setSavedHashId: function (id) {
			if (!id) return;
			window.location.hash = '/Saved/' + id;
		},
		clearSavedHash: function () {
			history.replaceState(null, null, ' ');
		},
		onSavedHashChange: function () {
			if (!this.canWriteGraphs || !this.savedGraphs.length) return;
			var hashId = this.getSavedHashId();
			if (!hashId) return;
			for (var i = 0; i < this.savedGraphs.length; i++) {
				if (String(this.savedGraphs[i].id) === String(hashId)) {
					if (this.savedGraphSelected !== i) this.savedGraphSelected = i;
					break;
				}
			}
		},
		parseSavedGraphName: function (name) {
			return String(name || '').trim();
		},
		sortSavedGraphs: function (graphs) {
			return graphs.slice().sort(function (a, b) {
				var an = String(a && a.name ? a.name : '').toLowerCase();
				var bn = String(b && b.name ? b.name : '').toLowerCase();
				if (an < bn) return -1;
				if (an > bn) return 1;
				return 0;
			});
		},
		normalizeSavedGraphPayload: function (graph) {
			var g = graph || {};
			var normalizeFeed = function (feed) {
				var f = feed || {};
				return {
					id: String(f.id || ''),
					name: String(f.name || ''),
					tag: String(f.tag || ''),
					unit: String(f.unit || ''),
					yaxis: Number(f.yaxis) === 2 ? 2 : 1,
					fill: Number(f.fill) ? 1 : 0,
					stack: Number(f.stack) ? 1 : 0,
					scale: String(f.scale !== undefined ? f.scale : '1'),
					offset: String(f.offset !== undefined ? f.offset : '0'),
					delta: Number(f.delta) ? 1 : 0,
					average: Number(f.average) ? 1 : 0,
					dp: isFinite(Number(f.dp)) ? Number(f.dp) : 1,
					plottype: String(f.plottype || 'lines'),
					color: String(f.color || '')
				};
			};

			return {
				id: g.id !== undefined ? String(g.id) : '',
				name: this.parseSavedGraphName(g.name),
				start: isFinite(Number(g.start)) ? Number(g.start) : 0,
				end: isFinite(Number(g.end)) ? Number(g.end) : 0,
				interval: isFinite(Number(g.interval)) ? Number(g.interval) : 60,
				mode: String(g.mode || 'interval'),
				limitinterval: Number(g.limitinterval) ? 1 : 0,
				fixinterval: !!g.fixinterval,
				floatingtime: Number(g.floatingtime) ? 1 : 0,
				yaxismin: g.yaxismin !== undefined ? String(g.yaxismin) : 'auto',
				yaxismax: g.yaxismax !== undefined ? String(g.yaxismax) : 'auto',
				yaxismin2: g.yaxismin2 !== undefined ? String(g.yaxismin2) : 'auto',
				yaxismax2: g.yaxismax2 !== undefined ? String(g.yaxismax2) : 'auto',
				showmissing: !!g.showmissing,
				showtag: !!g.showtag,
				showlegend: g.showlegend === undefined ? true : !!g.showlegend,
				showcsv: !!g.showcsv,
				csvtimeformat: String(g.csvtimeformat || 'unix'),
				csvnullvalues: String(g.csvnullvalues || 'show'),
				csvheaders: String(g.csvheaders || 'showNameTag'),
				feedlist: (Array.isArray(g.feedlist) ? g.feedlist : []).map(normalizeFeed)
			};
		},
		fetchSavedGraphs: function () {
			var self = this;
			return fetch(path + 'graph/getall' + (apikey ? '?apikey=' + apikey : ''))
				.then(function (r) {
					if (!r.ok) throw new Error('HTTP ' + r.status);
					return r.json();
				})
				.then(function (result) {
					var list = Array.isArray(result) ? result : ((result && result.user) ? result.user : []);
					self.savedGraphs = self.sortSavedGraphs(list);

					var targetId = String(load_savegraphs || self.getSavedHashId() || '');
					if (!targetId) return;
					for (var i = 0; i < self.savedGraphs.length; i++) {
						if (String(self.savedGraphs[i].id) === targetId) {
							self.savedGraphSelected = i;
							break;
						}
					}
				})
				.catch(function (err) {
					console.error('Failed to fetch saved graphs:', err);
				});
		},
		buildSavedGraphPayload: function () {
			var range = this.getWindowRange();
			var payload = {
				name: this.parseSavedGraphName(this.savedGraphName),
				start: range.startMs,
				end: range.endMs,
				interval: Number(this.state.interval) || 60,
				mode: this.state.mode || 'interval',
				limitinterval: this.state.limitinterval ? 1 : 0,
				fixinterval: !!this.state.fixinterval,
				floatingtime: this.state.floatingtime ? 1 : 0,
				yaxismin: this.state.yaxismin,
				yaxismax: this.state.yaxismax,
				yaxismin2: this.state.yaxismin2,
				yaxismax2: this.state.yaxismax2,
				showmissing: !!this.state.showmissing,
				showtag: !!this.state.showtag,
				showlegend: !!this.state.showlegend,
				showcsv: !!this.state.showcsv,
				csvtimeformat: this.state.csvtimeformat,
				csvnullvalues: this.state.csvnullvalues,
				csvheaders: this.state.csvheaders,
				feedlist: this.state.feedlist.map(function (feed) {
					return {
						id: feed.id,
						name: feed.name,
						tag: feed.tag,
						unit: feed.unit,
						yaxis: feed.yaxis,
						fill: feed.fill,
						scale: feed.scale,
						offset: feed.offset,
						delta: feed.delta,
						average: feed.average,
						dp: feed.dp,
						plottype: feed.plottype,
						color: feed.color
					};
				})
			};

			if (this.savedGraphSelected > -1 && this.savedGraphs[this.savedGraphSelected]) {
				payload.id = this.savedGraphs[this.savedGraphSelected].id;
			}

			return payload;
		},
		applySavedGraphPayload: function (graph) {
			if (!graph || typeof graph !== 'object') return;

			var start = Number(graph.start);
			var end = Number(graph.end);
			if (!isFinite(start) || !isFinite(end) || start >= end) {
				var fallback = this.getWindowRange();
				start = fallback.startMs;
				end = fallback.endMs;
			}

			this.syncWindowInputs(start, end);
			this.state.mode = graph.mode || 'interval';
			this.state.interval = String(graph.interval || this.state.interval || 60);
			this.state.limitinterval = !!Number(graph.limitinterval);
			this.state.fixinterval = !!graph.fixinterval;
			this.state.floatingtime = !!Number(graph.floatingtime);

			this.state.yaxismin = graph.yaxismin !== undefined ? graph.yaxismin : 'auto';
			this.state.yaxismax = graph.yaxismax !== undefined ? graph.yaxismax : 'auto';
			this.state.yaxismin2 = graph.yaxismin2 !== undefined ? graph.yaxismin2 : 'auto';
			this.state.yaxismax2 = graph.yaxismax2 !== undefined ? graph.yaxismax2 : 'auto';

			this.state.showmissing = !!graph.showmissing;
			this.state.showtag = !!graph.showtag;
			this.state.showlegend = graph.showlegend === undefined ? true : !!graph.showlegend;
			this.state.showcsv = !!graph.showcsv;
			this.state.csvtimeformat = graph.csvtimeformat || 'unix';
			this.state.csvnullvalues = graph.csvnullvalues || 'show';
			this.state.csvheaders = graph.csvheaders || 'showNameTag';

			this.hiddenFeedIds.clear();
			this.state.feedlist.splice(0);
			var feedlist = Array.isArray(graph.feedlist) ? graph.feedlist : [];
			for (var i = 0; i < feedlist.length; i++) {
				var feed = feedlist[i] || {};
				this.state.feedlist.push({
					id: feed.id,
					name: feed.name || '',
					tag: feed.tag || '',
					unit: feed.unit || '',
					yaxis: Number(feed.yaxis) === 2 ? 2 : 1,
					fill: Number(feed.fill) ? 1 : 0,
					stack: Number(feed.stack) ? 1 : 0,
					scale: feed.scale !== undefined ? String(feed.scale) : '1',
					offset: feed.offset !== undefined ? String(feed.offset) : '0',
					delta: Number(feed.delta) ? 1 : 0,
					average: Number(feed.average) ? 1 : 0,
					dp: isFinite(Number(feed.dp)) ? Number(feed.dp) : 1,
					plottype: feed.plottype || 'lines',
					color: feed.color || '',
					autoColor: '',
					stats: {},
					data: []
				});
			}

			this.fetchFeedData();
			if (this.state.showcsv) this.updateCsvText();
		},
		onSavedGraphSelectedChange: function (newVal) {
			var idx = Number(newVal);
			if (!isFinite(idx) || idx < 0 || idx >= this.savedGraphs.length) {
				this.savedGraphName = '';
				this.clearSavedHash();
				return;
			}

			var selected = this.savedGraphs[idx];
			if (!selected) return;
			this.savedGraphName = selected.name || '';
			this.setSavedHashId(selected.id);

			if (selected.feedlist) {
				this.applySavedGraphPayload(selected);
				return;
			}

			var self = this;
			fetch(path + 'graph/get?id=' + encodeURIComponent(String(selected.id)) + (apikey ? '&apikey=' + apikey : ''))
				.then(function (r) {
					if (!r.ok) throw new Error('HTTP ' + r.status);
					return r.json();
				})
				.then(function (graph) {
					self.applySavedGraphPayload(graph);
				})
				.catch(function (err) {
					console.error('Failed to load saved graph:', err);
				});
		},
		onSaveSavedGraph: function () {
			if (!this.canWriteGraphs) return;
			var name = this.parseSavedGraphName(this.savedGraphName);
			if (!name) {
				this.showSavedGraphStatus('<?php echo tr('Graph Name'); ?> required');
				return;
			}

			var payload = this.buildSavedGraphPayload();
			payload.name = encodeURIComponent(name);

			var self = this;
			var params = new URLSearchParams();
			var endpoint = 'graph/create';
			if (payload.id) {
				endpoint = 'graph/update';
				params.set('id', String(payload.id));
			}
			params.set('data', JSON.stringify(payload));

			fetch(path + endpoint + (apikey ? '?apikey=' + apikey : ''), {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
				body: params.toString()
			})
				.then(function (r) {
					if (!r.ok) throw new Error('HTTP ' + r.status);
					return r.json();
				})
				.then(function (res) {
					if (!res || res.success === false) throw new Error((res && res.message) || 'Save failed');
					self.showSavedGraphStatus(res.message || '<?php echo tr('Saved'); ?>');

					var createdId = null;
					if (!payload.id && res.message) {
						var match = String(res.message).match(/graph saved id\s*:\s*(\d+)/i);
						if (match) createdId = match[1];
					}

					self.fetchSavedGraphs().then(function () {
						var targetId = createdId || payload.id;
						if (!targetId) return;
						for (var i = 0; i < self.savedGraphs.length; i++) {
							if (String(self.savedGraphs[i].id) === String(targetId)) {
								self.savedGraphSelected = i;
								break;
							}
						}
					});
				})
				.catch(function (err) {
					self.showSavedGraphStatus('Error: ' + err.message);
				});
		},
		onDeleteSavedGraph: function () {
			if (!this.canWriteGraphs) return;
			if (this.savedGraphSelected < 0 || this.savedGraphSelected >= this.savedGraphs.length) return;

			var graph = this.savedGraphs[this.savedGraphSelected];
			if (!graph) return;
			if (!window.confirm('Delete ' + (graph.name || '') + ' (#' + graph.id + ')?')) return;

			var self = this;
			var params = new URLSearchParams();
			params.set('id', String(graph.id));

			fetch(path + 'graph/delete' + (apikey ? '?apikey=' + apikey : ''), {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
				body: params.toString()
			})
				.then(function (r) {
					if (!r.ok) throw new Error('HTTP ' + r.status);
					return r.json();
				})
				.then(function (res) {
					if (!res || res.success === false) throw new Error((res && res.message) || 'Delete failed');
					self.savedGraphSelected = -1;
					self.savedGraphName = '';
					self.clearSavedHash();
					self.showSavedGraphStatus(res.message || '<?php echo tr('Deleted'); ?>');
					return self.fetchSavedGraphs();
				})
				.catch(function (err) {
					self.showSavedGraphStatus('Error: ' + err.message);
				});
		},
		parseFeedIds: function (raw) {
			if (raw === undefined || raw === null) return [];
			var text = String(raw).trim();
			if (!text) return [];
			return text.split(',')
				.map(function (part) { return Number(String(part).trim()); })
				.filter(function (id) { return isFinite(id) && id > 0; });
		},
		findFeedById: function (feedid) {
			for (var i = 0; i < this.feeds.length; i++) {
				if (String(this.feeds[i].id) === String(feedid)) return this.feeds[i];
			}
			return null;
		},
		addInitialFeed: function (feedMeta, yaxis) {
			if (!feedMeta) return;

			for (var i = 0; i < this.state.feedlist.length; i++) {
				if (String(this.state.feedlist[i].id) === String(feedMeta.id)) {
					this.state.feedlist[i].yaxis = yaxis;
					return;
				}
			}

			this.state.feedlist.push(Object.assign({
				plottype: 'lines',
				fill: 0,
				stack: 0,
				scale: '1',
				offset: '0',
				delta: 0,
				average: 0,
				dp: 1,
				yaxis: yaxis,
				stats: {},
				data: [],
				autoColor: ''
			}, feedMeta));
		},
		getPathFeedIds: function () {
			var pathName = window.location.pathname || '';
			var parts = pathName.split('graph/');
			if (parts.length < 2) return [];
			var afterGraph = parts[parts.length - 1].split('/')[0];
			if (!afterGraph) return [];
			return this.parseFeedIds(afterGraph);
		},
		applyUrlFeedSelection: function () {
			var leftIds = this.getPathFeedIds();
			leftIds = leftIds.concat(this.parseFeedIds(typeof feedidsLH !== 'undefined' ? feedidsLH : ''));
			var rightIds = this.parseFeedIds(typeof feedidsRH !== 'undefined' ? feedidsRH : '');

			if (!leftIds.length && !rightIds.length) return;

			for (var i = 0; i < leftIds.length; i++) {
				this.addInitialFeed(this.findFeedById(leftIds[i]), 1);
			}
			for (var j = 0; j < rightIds.length; j++) {
				this.addInitialFeed(this.findFeedById(rightIds[j]), 2);
			}

			this.fetchFeedData();
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
			var removeNull = !!this.state.removeNull;
			var maxDuration = parseFloat(this.state.removeNullMaxDuration);
			var intervalSeconds = parseFloat(this.state.interval);
			if (!isFinite(maxDuration) || maxDuration <= 0) maxDuration = 900;
			if (!isFinite(intervalSeconds) || intervalSeconds <= 0) intervalSeconds = 60;
			var nullGapFillEnabled = removeNull && this.state.mode === 'interval' && intervalSeconds < maxDuration;

			for (var i = 0; i < this.state.feedlist.length; i++) {
				var feed = this.state.feedlist[i];
				var data = Array.isArray(feed.data)
					? feed.data.map(function (pt) { return [pt[0], pt[1]]; })
					: [];
				var scale = parseFloat(feed.scale);
				if (!isFinite(scale)) scale = 1;
				var offset = parseFloat(feed.offset);
				if (!isFinite(offset)) offset = 0;

				if (nullGapFillEnabled && data.length > 1) {
					data = this.fillShortNullGaps(data, intervalSeconds, maxDuration);
				}

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
				var isHidden = this.hiddenFeedIds.has(feed.id);
				if (feed.color) series.color = feed.color;

				if (feed.plottype === 'lines') series.lines = { show: !isHidden, fill: fillVal, lineWidth: 2 };
				if (feed.plottype === 'bars') series.bars = { show: !isHidden, fill: fillVal, align: 'center', barWidth: 45 * 60 * 1000 };
				if (feed.plottype === 'points') series.points = { show: !isHidden, radius: 3 };
				if (feed.plottype === 'steps') series.lines = { show: !isHidden, fill: fillVal, steps: true };

				if (!series.lines && !series.bars && !series.points) {
					series.lines = { show: !isHidden, fill: fillVal, lineWidth: 2 };
				}

				plotdata.push(series);
			}

			return plotdata;
		},
		renderChart: function () {
			var placeholder = document.getElementById('placeholder');
			if (!placeholder) return;
			this.graphResize();

			var range = this.getWindowRange();
			var startMs = range.startMs;
			var endMs = range.endMs;
			var timeInWindowSeconds = (endMs - startMs) / 1000;

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
				legend: { show: this.state.showlegend, position: 'nw' },
				toggle: { scale: 'visible' },
				touch: { pan: 'x', scale: 'x' }
			};

			var leftHasExplicit = false, rightHasExplicit = false;
			if (this.state.yaxismin !== 'auto' && this.state.yaxismin !== '') { options.yaxes[0].min = parseFloat(this.state.yaxismin); leftHasExplicit = true; }
			if (this.state.yaxismax !== 'auto' && this.state.yaxismax !== '') { options.yaxes[0].max = parseFloat(this.state.yaxismax); leftHasExplicit = true; }
			if (leftHasExplicit) options.yaxes[0].autoScale = 'none';
			if (this.state.yaxismin2 !== 'auto' && this.state.yaxismin2 !== '') { options.yaxes[1].min = parseFloat(this.state.yaxismin2); rightHasExplicit = true; }
			if (this.state.yaxismax2 !== 'auto' && this.state.yaxismax2 !== '') { options.yaxes[1].max = parseFloat(this.state.yaxismax2); rightHasExplicit = true; }
			if (rightHasExplicit) options.yaxes[1].autoScale = 'none';

			var plotdata = this.buildPlotData();
			var statsMaxDuration = parseFloat(this.state.removeNullMaxDuration);
			if (!isFinite(statsMaxDuration) || statsMaxDuration <= 0) statsMaxDuration = 900;
			var statsIntervalSeconds = parseFloat(this.state.interval);
			if (!isFinite(statsIntervalSeconds) || statsIntervalSeconds <= 0) statsIntervalSeconds = 60;
			var statsRemoveNullEnabled = !!this.state.removeNull && this.state.mode === 'interval' && statsIntervalSeconds < statsMaxDuration;
			for (var s = 0; s < this.state.feedlist.length; s++) {
				var statsFeed = this.state.feedlist[s];
				var statsData = this.buildProcessedDataForStats(statsFeed, statsIntervalSeconds, statsMaxDuration, statsRemoveNullEnabled);
				statsFeed.stats = this.calculateFeedStats(statsData, timeInWindowSeconds);
			}

			if (window.Flot && typeof window.Flot.plot === 'function') {
				var plot = window.Flot.plot(placeholder, plotdata, options);
				this.attachLegendToggle(plot);
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
				if (this.state.showcsv) {
					this.csvText = this.buildCsvText();
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
			if (this.state.showcsv) {
				this.csvText = this.buildCsvText();
			}
		},
		onClearAll: function () {
			this.hiddenFeedIds.clear();
			this._previousHoverPoint = null;
			this.removeTooltip();
			this.state.feedlist.splice(0);
			this.state.mode = 'interval';
			this.state.fixinterval = false;
			this.state.limitinterval = true;
			this.state.showmissing = true;
			this.state.showlegend = true;
			this.state.showtag = false;
			this.state.showcsv = false;
			this.state.showStats = false;
			this.state.yaxismin = 'auto';
			this.state.yaxismax = 'auto';
			this.state.yaxismin2 = 'auto';
			this.state.yaxismax2 = 'auto';
			this.state.removeNull = false;
			this.state.removeNullMaxDuration = '900';
			this.state.csvtimeformat = 'unix';
			this.state.csvnullvalues = 'show';
			this.state.csvheaders = 'showNameTag';
			var endMs = Math.round(Date.now() / 1000) * 1000;
			var startMs = endMs - 7 * 24 * 3600 * 1000;
			this.graphTimeHours = '168';
			this.calcIntervalForWindow(startMs, endMs);
			this.syncWindowInputs(startMs, endMs);
			this.renderChart();
		},
		onYAxisBoundsChange: function () {
			this.renderChart();
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
			this.renderChart();
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
