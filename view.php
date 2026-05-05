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
load_js("Lib/js/flot-5.1.0.min.js");
load_js("Lib/js/clipboard.js");
load_js("Lib/js/DateTimePicker.js");
?>

<div id="graph-view-app">
	<div id="error" class="alert" :class="errorType==='info' ? 'alert-info' : 'alert-danger'" v-show="errorMessage">
		{{ errorMessage }}
		<button type="button" class="btn" style="margin-left:8px" v-if="errorBadFeedIds.length" @click="onRemoveMissingFeeds"><?php echo tr('Remove missing'); ?></button>
	</div>

	<!-- ── Graph card ─────────────────────────────────────────────── -->
	<div class="card" style="background-color: var(--bg-body)">

		<nav class="card-header">
			<div class="card-name">
				<span class="icon-show_chart text-accent"></span>
				<?php echo tr('Data viewer'); ?>
			</div>
			<button class="btn" v-if="histogramMode" @click="onHistogramBackClick"><?php echo tr('Back to main view'); ?></button>
		</nav>

		<!-- Normal navigation controls -->
		<div class="card-header" v-show="!histogramMode">
			<select class="graph_time" style="width:110px" v-model="graphTimeHours" @change="onGraphTimeRefresh">
				<option value="1"><?php echo tr('1 hour'); ?></option>
				<option value="6"><?php echo tr('6 hours'); ?></option>
				<option value="12"><?php echo tr('12 hours'); ?></option>
				<option value="24"><?php echo tr('24 hours'); ?></option>
				<option value="168"><?php echo tr('1 Week'); ?></option>
				<option value="336"><?php echo tr('2 Weeks'); ?></option>
				<option value="720"><?php echo tr('Month'); ?></option>
				<option value="8760"><?php echo tr('Year'); ?></option>
			</select>

			<div class="input-prepend input-append" style="margin-left:8px;">
				<button class="btn" id="graph_zoomin" title="<?php echo tr('Zoom In'); ?>" @click="onZoomIn">+</button>
				<button class="btn" id="graph_zoomout" title="<?php echo tr('Zoom Out'); ?>" @click="onZoomOut">−</button>
				<button class="btn" id="graph_left" title="<?php echo tr('Earlier'); ?>" @click="onPan(-1)">‹</button>
				<button class="btn" id="graph_right" title="<?php echo tr('Later'); ?>" @click="onPan(1)">›</button>
			</div>

			<div class="ctrl-group">
				<span class="ctrl-label"><?php echo tr('Start'); ?></span>
				<date-time-picker v-model="startLocal" @change="onReload"></date-time-picker>
			</div>

			<div class="ctrl-group">
				<span class="ctrl-label"><?php echo tr('End'); ?></span>
				<date-time-picker v-model="endLocal" @change="onReload"></date-time-picker>
			</div>

			<div id="showcontrols">
				<label class="ctrl-checkbox"><input type="checkbox" id="showlegend" v-model="state.showlegend"> <?php echo tr('Legend'); ?></label>
				<label class="ctrl-checkbox"><input type="checkbox" id="showtag" v-model="state.showtag"> <?php echo tr('Feed tag'); ?></label>
			</div>
		</div>

		<!-- Histogram controls -->
		<div class="card-header" v-show="histogramMode">
			<div class="input-prepend input-append">
				<span class="add-on" style="width:75px"><?php echo tr('Type'); ?></span>
				<select style="width:150px" v-model="histogramType" @change="drawHistogram">
					<option value="timeatvalue"><?php echo tr('Time at value'); ?></option>
					<option value="kwhatpower"><?php echo tr('kWh at Power'); ?></option>
				</select>
				<span class="add-on" style="width:75px"><?php echo tr('Resolution'); ?></span>
				<input type="text" style="width:60px" v-model="histogramResolution" @change="drawHistogram">
			</div>
		</div>

		<!-- Graph area -->
		<div class="card-body">
			<div id="legend"></div>
			<div id="placeholder_bound" style="width:100%; height:400px;">
				<div id="placeholder"></div>
			</div>
		</div>

	</div>

	<!-- ── Options card ───────────────────────────────────────────── -->
	<div id="info" class="card">

		<nav class="card-header">
			<span class="icon-cog text-accent card-header-icon"></span>
			<div class="card-name">
				<?php echo tr('Graph options'); ?>
			</div>
		</nav>

		<div class="card-controls">

			<div class="controls-row">
				<div class="input-prepend input-append">
					<span class="add-on" style="width:50px"><?php echo tr('Type'); ?></span>
					<select id="request-type" style="width:130px" v-model="state.mode" @change="onReload">
						<option value="interval"><?php echo tr('Fixed Interval'); ?></option>
						<option value="daily"><?php echo tr('Daily'); ?></option>
						<option value="weekly"><?php echo tr('Weekly'); ?></option>
						<option value="monthly"><?php echo tr('Monthly'); ?></option>
						<option value="annual"><?php echo tr('Annual'); ?></option>
					</select>
				</div>

				<div class="input-prepend input-append" v-show="state.mode==='interval'">
					<input id="request-interval" type="text" style="width:60px" v-model="state.interval" :disabled="state.fixinterval" @change="onReload">
					<span class="add-on"><?php echo tr('Fix'); ?> <input id="request-fixinterval" type="checkbox" style="margin-top:1px" v-model="state.fixinterval"></span>
					<span class="add-on"><?php echo tr('Limit to data interval'); ?> <input id="request-limitinterval" type="checkbox" style="margin-top:1px" v-model="state.limitinterval"></span>
				</div>
			</div>

			<div class="controls-row">
				<div id="yaxis_left" class="input-append input-prepend" v-show="leftCount > 0">
					<span id="yaxis-left" class="add-on"><?php echo tr('Y-axis').' ('.tr('Left').')'; ?>:</span>
					<span class="yaxis-minmax-label add-on"><?php echo tr('min'); ?></span>
					<input class="yaxis-minmax" id="yaxis-min" type="text" v-model="state.yaxismin" @change="onYAxisBoundsChange">
					<span class="yaxis-minmax-label add-on"><?php echo tr('max'); ?></span>
					<input class="yaxis-minmax" id="yaxis-max" type="text" v-model="state.yaxismax" @change="onYAxisBoundsChange">
					<button class="btn reset-yaxis" @click="resetYAxis('left')"><?php echo tr('Reset'); ?></button>
				</div>

				<div id="yaxis_right" class="input-append input-prepend" v-show="rightCount > 0">
					<span id="yaxis-right" class="add-on"><?php echo tr('Y-axis').' ('.tr('Right').')'; ?>:</span>
					<span class="yaxis-minmax-label add-on"><?php echo tr('min'); ?></span>
					<input class="yaxis-minmax" id="yaxis-min2" type="text" v-model="state.yaxismin2" @change="onYAxisBoundsChange">
					<span class="yaxis-minmax-label add-on"><?php echo tr('max'); ?></span>
					<input class="yaxis-minmax" id="yaxis-max2" type="text" v-model="state.yaxismax2" @change="onYAxisBoundsChange">
					<button class="btn reset-yaxis" @click="resetYAxis('right')"><?php echo tr('Reset'); ?></button>
				</div>
			</div>

			<div class="controls-row" v-show="state.mode==='interval'">
				<div class="input-prepend input-append">
					<span class="add-on"><?php echo tr('Fill null values with last'); ?></span>
					<span class="add-on"><input type="checkbox" class="remove-null" style="margin-top:3px" v-model="state.removeNull" @change="onRemoveNullChange"></span>
					<span class="add-on" v-if="state.removeNull"><?php echo tr('Max fill length'); ?></span>
					<input type="text" class="remove-null-max-duration" style="width:60px" v-if="state.removeNull" v-model="state.removeNullMaxDuration" @change="onRemoveNullChange">
					<span class="add-on" v-if="state.removeNull"><?php echo tr('s'); ?></span>
					<span class="add-on"><?php echo tr('Show remaining'); ?></span>
					<span class="add-on"><input type="checkbox" id="showmissing" style="margin-top:1px" v-model="state.showmissing"></span>
				</div>
			</div>

			<div id="window-info" class="window-info" v-if="windowInfo">
				<b><?php echo tr('Window'); ?>:</b> {{ windowInfo.start }} <b>&#x2192;</b> {{ windowInfo.end }}
				&nbsp;&middot;&nbsp; <b><?php echo tr('Length'); ?>:</b> {{ windowInfo.length }}
			</div>

		</div><!-- .card-controls -->

		<div class="feed-options" :class="{hide: state.feedlist.length===0 || histogramMode}" v-show="!histogramMode">
			<div class="card" :class="{'tables-collapsed': tablesCollapsed}">
				<div class="card-header feed-options-header" @click="toggleTablesCollapsed">
					<span class="card-accent"></span>
					<span class="card-name feed-options-title"><?php echo tr('Feeds in view'); ?></span>

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
								<td class="col-primary">{{ feedName(feed) }}</td>
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

		<div class="card-controls" style="border-top: 1px solid var(--border)">
			<div class="controls-row">
				<div class="input-prepend input-append">
					<button class="btn" id="showcsv" @click="toggleCsv">{{ csvButtonLabel }}</button>
					<span class="add-on csvoptions" v-show="state.showcsv"><?php echo tr('Time format'); ?>:</span>
					<select id="csvtimeformat" class="csvoptions" v-show="state.showcsv" v-model="state.csvtimeformat">
						<option value="unix"><?php echo tr('Unix timestamp'); ?></option>
						<option value="seconds"><?php echo tr('Seconds since start'); ?></option>
						<option value="datestr"><?php echo tr('Date-time string'); ?></option>
					</select>
				</div>
				<div class="input-prepend input-append" v-show="state.showcsv">
					<span class="add-on csvoptions"><?php echo tr('Null values'); ?>:</span>
					<select id="csvnullvalues" class="csvoptions" v-model="state.csvnullvalues">
						<option value="show"><?php echo tr('Show'); ?></option>
						<option value="lastvalue"><?php echo tr('Replace with last value'); ?></option>
						<option value="remove"><?php echo tr('Remove whole line'); ?></option>
					</select>
				</div>
				<div class="input-prepend input-append" v-show="state.showcsv">
					<span class="add-on csvoptions"><?php echo tr('Headers'); ?>:</span>
					<select id="csvheaders" class="csvoptions" v-model="state.csvheaders">
						<option value="showNameTag"><?php echo tr('Show name and tag'); ?></option>
						<option value="showName"><?php echo tr('Show name'); ?></option>
						<option value="hide"><?php echo tr('Hide'); ?></option>
					</select>
				</div>
				<div class="ctrl-actions" v-show="state.showcsv">
					<button id="download-csv" class="btn csvoptions" @click="onDownloadCsv"><?php echo tr('Download'); ?></button>
					<button class="btn csvoptions" id="copy-csv" type="button" @click="onCopyCsv"><?php echo tr('Copy'); ?> <i class="icon-share-alt"></i></button>
					<span id="copy-csv-feedback" class="csvoptions"></span>
				</div>
			</div>
			<textarea id="csv" style="width:100%; height:500px; box-sizing:border-box" v-show="state.showcsv" v-model="csvText"></textarea>
		</div><!-- .card-controls (csv) -->

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
							<td><input type="checkbox" :checked="leftChecked.has(feed.id)" @change="onYAxisChange(feed.id, 1, $event.target.checked)"></td>
							<td><input type="checkbox" :checked="rightChecked.has(feed.id)" @change="onYAxisChange(feed.id, 2, $event.target.checked)"></td>
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
	</div>
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
	'Hide CSV Output': "<?php echo tr('Hide CSV Output'); ?>",
	'Show CSV Output': "<?php echo tr('Show CSV Output'); ?>",
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
	'Deleted': "<?php echo tr('Deleted'); ?>"
};
</script>

<?php load_js("Modules/graph/graph.lib.js"); ?>
<?php load_js("Modules/graph/graph.core.js"); ?>