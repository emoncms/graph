<?php
defined('EMONCMS_EXEC') or die('Restricted access');

global $session, $mysqli;

// Check if group module is installed
$group = false;
$result = $mysqli->query("SHOW TABLES LIKE 'groups'");
if ($result->num_rows > 0) {
    require_once "Modules/group/group_model.php";
    $group = new Group($mysqli, null, null, null, null);
}

require_once "Modules/graph/graph_model.php";
$graph = new Graph($mysqli, $group);
$savedgraphs = $graph->getall($session['userid']);

$savedgraphsnamelist = array();
foreach ($savedgraphs['user'] as $savedgraph) {
    $savedgraphsnamelist[] = array($savedgraph->id, $savedgraph->name);
}
foreach ($savedgraphs['groups'] as $group_graphs) {
    foreach ($group_graphs as $savedgraph) {
        $savedgraphsnamelist[] = array($savedgraph->id, $savedgraph->name);
    }
}

?>
<script>var savedgraphsnamelist = <?php echo json_encode($savedgraphsnamelist); ?>;</script>
