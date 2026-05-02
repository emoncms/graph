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

load_css("Modules/graph/style.css");
load_js("Lib/flot-5.1.0.min.js");
load_js("Lib/moment.min.js");
load_js("Lib/vue.global.min.js");
?>

<div id="graph-view-app" class="graph-embed-view">
	<div id="error" class="alert" :class="errorType==='info' ? 'alert-info' : 'alert-danger'" v-show="errorMessage">
		{{ errorMessage }}
		<button type="button" class="btn" style="margin-left:8px" v-if="errorBadFeedIds.length" @click="onRemoveMissingFeeds"><?php echo tr('Remove missing'); ?></button>
	</div>

	<div id="navigation" style="padding-bottom:4px;" v-show="!histogramMode">
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
			<button id="graph_zoomin" class="btn" style="min-width:40px" title="<?php echo tr('Zoom In'); ?>" @click="onZoomIn">+</button>
			<button id="graph_zoomout" class="btn" style="min-width:40px" title="<?php echo tr('Zoom Out'); ?>" @click="onZoomOut">-</button>
			<button id="graph_left" class="btn" style="min-width:40px" title="<?php echo tr('Earlier'); ?>" @click="onPan(-1)"><</button>
			<button id="graph_right" class="btn" style="min-width:40px" title="<?php echo tr('Later'); ?>" @click="onPan(1)">></button>
		</div>
	</div>

	<div class="input-prepend input-append" style="margin-bottom:5px">
		<span class="add-on"><?php echo tr('Start'); ?>:</span>
		<input id="request-start" type="datetime-local" style="width:185px" v-model="startLocal" @change="onReload">
		<span class="add-on"><?php echo tr('End'); ?>:</span>
		<input id="request-end" type="datetime-local" style="width:185px" v-model="endLocal" @change="onReload">
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

<?php load_js("Modules/graph/helpers.js"); ?>
<?php load_js("Modules/graph/main.js"); ?>
