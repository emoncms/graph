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

$apikey      = $_GET['apikey'] ?? '';
$feedidsLH   = $_GET['feedidsLH'] ?? '';
$feedidsRH   = $_GET['feedidsRH'] ?? '';
$graphid     = $_GET['graphid'] ?? '';
$load_saved  = $_GET['load'] ?? '';
$load_saved  = $graphid !== '' ? $graphid : $load_saved;

$min_feed_interval = 10;
if (isset($settings['feed']['min_feed_interval'])) {
	$min_feed_interval = (int) $settings['feed']['min_feed_interval'];
}
load_js("Lib/js/vue.global.prod-3.5.22.min.js");
load_js("Lib/js/flot-5.1.0.js");
load_js("Lib/js/clipboard.js");
load_js("Lib/js/DateTimePicker.js");
load_css("Theme/css/datetimepicker.css");

?>

<style>
body {
	background: none;
}
#legend { width: 100%; float: right; position: relative; z-index: 2; font-size: 13px; }
#legend .col { position: absolute; top: 0; }
#legend .right { right: 0.8em; }
#legend .left { left: 0; }
.legendLayer rect.background { fill: rgba(255, 255, 255, 0.6); }
.legend { font-size: 13px; }

#graph_zoomin, #graph_zoomout, #graph_left, #graph_right { font-weight: 700; }
</style>

<div id="graph-view-app" class="graph-embed-view">
	<div id="error" class="alert" :class="errorType==='info' ? 'alert-info' : 'alert-danger'" v-show="errorMessage">
		{{ errorMessage }}
		<button type="button" class="btn" style="margin-left:8px" v-if="errorBadFeedIds.length" @click="onRemoveMissingFeeds"><?php echo tr('Remove missing'); ?></button>
	</div>

	<div id="navigation" style="padding-bottom:4px;" v-show="!histogramMode && !showTimeManual">
		<div class="input-prepend input-append" style="margin-bottom:0 !important; margin-left:2px;">
			<button class="btn graph_time_refresh" title="<?php echo tr('Refresh'); ?>" @click="onGraphTimeRefresh"><i class="icon-repeat"></i></button>
			<select class="btn graph_time" style="width:95px; padding-left:5px" v-model="graphTimeHours" @change="onGraphTimeRefresh">
				<option value="1"><?php echo tr('1 hour'); ?></option>
				<option value="6"><?php echo tr('6 hours'); ?></option>
				<option value="12"><?php echo tr('12 hours'); ?></option>
				<option value="24"><?php echo tr('24 hours'); ?></option>
				<option value="168"><?php echo tr('1 Week'); ?></option>
				<option value="336"><?php echo tr('2 Weeks'); ?></option>
				<option value="720"><?php echo tr('Month'); ?></option>
				<option value="8760"><?php echo tr('Year'); ?></option>
			</select>
		</div>
		<div style="margin-bottom:0 !important; margin-left:4px; display:inline-block;">&nbsp;
			<button class="btn navigation-timewindow" title="<?php echo tr('Select time window'); ?>" @click="showTimeManual = true"><i class="icon-resize-horizontal"></i></button>&nbsp;
			<button id="graph_zoomin" class="btn" style="min-width:40px" title="<?php echo tr('Zoom In'); ?>" @click="onZoomIn">+</button>&nbsp;
			<button id="graph_zoomout" class="btn" style="min-width:40px" title="<?php echo tr('Zoom Out'); ?>" @click="onZoomOut">-</button>&nbsp;
			<button id="graph_left" class="btn" style="min-width:40px" title="<?php echo tr('Earlier'); ?>" @click="onPan(-1)"><</button>&nbsp;
			<button id="graph_right" class="btn" style="min-width:40px" title="<?php echo tr('Later'); ?>" @click="onPan(1)">></button>
		</div>
	</div>

	<div v-show="!histogramMode && showTimeManual" style="margin-bottom:4px; margin-left:2px">
		<div class="input-prepend input-append">
			<span class="add-on"><?php echo tr('Select time window'); ?></span>
			<span class="add-on"><?php echo tr('Start'); ?></span>
			<date-time-picker v-model="startLocal" @change="onReload"></date-time-picker>
			<span class="add-on"><?php echo tr('End'); ?></span>
			<date-time-picker v-model="endLocal" @change="onReload"></date-time-picker>
			<button class="btn navigation-timewindow-set" title="<?php echo tr('Done'); ?>" @click="showTimeManual = false"><i class="icon-ok"></i></button>
		</div>
	</div>

	<div id="legend"></div>
	<div id="placeholder_bound" style="width:100%; height:100%">
		<div id="placeholder"></div>
	</div>
</div>

<script>
var path = "<?php echo $path; ?>";
const graph_embed = true;
const min_feed_interval = <?php echo $min_feed_interval; ?>;
const apikey = "<?php echo $apikey; ?>";
const apikeystr = apikey !== '' ? '&apikey=' + apikey : '';
const feedidsLH = "<?php echo $feedidsLH; ?>";
const feedidsRH = "<?php echo $feedidsRH; ?>";
const load_savegraphs = "<?php echo $load_saved; ?>";
var session_write = 0;
var graphTranslations = {
	'Hide CSV Output': "<?php echo tr('Hide CSV Output'); ?>",
	'Show CSV Output': "<?php echo tr('Show CSV Output'); ?>",
	'Copied': "<?php echo tr('Copied'); ?>",
	'Copy not supported': "<?php echo tr('Copy not supported'); ?>",
	'Request error': "<?php echo tr('Request error'); ?>",
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
