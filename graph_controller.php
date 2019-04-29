<?php

// no direct access
defined('EMONCMS_EXEC') or die('Restricted access');

function graph_controller()
{
    global $session,$route,$mysqli,$redis, $path;

    // Check if group module is installed
    $group = false;
    if (file_exists("Modules/group/group_model.php")) {
        require_once "Modules/group/group_model.php";
        $group = new Group($mysqli, $redis, null, null, null);
    }

    require_once "Modules/graph/graph_model.php";
    $graph = new Graph($mysqli, $group);

    $result = "";
    
    if ($route->action=="embed") {
        global $embed; $embed = true;
        $result = view("Modules/graph/embed.php",array());
    }
    
    // Standard graph methods
    else if ($session['write'] && $route->action=="create" && isset($_POST['data'])) {
        $route->format="json";
        $result = $graph->create($session['userid'],post('data'));
    }
    
    else if ($session['write'] && $route->action=="update" && isset($_POST['id']) && isset($_POST['data'])) {
        $route->format="json";
        $result = $graph->update($session['userid'],post('id'),post('data'));
    }
    
    else if ($session['write'] && $route->action=="delete" && isset($_POST['id'])) {
        $route->format="json";
        $result = $graph->delete($session['userid'],post('id'));
    }
    
    else if ($route->action=="get" && isset($_GET['id'])) {
        $route->format="json";
        if (isset($session['userid'])) $userid = $session['userid']; else $userid = 0;
        $result = $graph->get($userid,get('id'));
    }

    else if ($session['read'] && $route->action=="getall") {
        $route->format="json";
        $result = $graph->getall($session['userid']);
    }
    
    // Group graph methods
    else if ($group && $session['write'] && $route->action == "creategroupgraph" && isset($_POST['data']) && isset($_POST['groupid'])) {
        $route->format = "json";
        $result = $graph->creategroupgraph($session['userid'], post('data'), post('groupid'));
    }
    
    else if ($group && $session['write'] && $route->action == "updategroupgraph" && isset($_POST['id']) && isset($_POST['data'])) {
        $route->format = "json";
        $result = $graph->updategroupgraph($session['userid'], post('id'), post('data'),post('groupid'));
    }
    
    else if ($group && $session['write'] && $route->action == "deletegroupgraph" && isset($_POST['id'])) {
        $route->format = "json";
        $result = $graph->deletegroupgraph($session['userid'], post('id'));
    }
    
    else if ($group && $route->action=="groupgraph") {
        $result = view("Modules/graph/view.php", array("session" => $session["write"], 'group_support' => 1));
    }
    // Download data
    else if ($route->action === 'download') {
        $ids = explode(',', get('ids'));
        $start = get('start');
        $end = get('end');
        $shownull = get('shownull');
        $headers = get('headers'); // tags|names|none
        $format = get('timeformat'); // datestr|unix|seconds
        $nullvalues = get('nullvalues'); // lastvalue|remove|show

        $interval = get('interval');
        $skipmissing = get('skipmissing');
        $limitinterval = get('limitinterval');
        
        // @todo: make use of new multi id data endpoint
        $id = $ids[0];
        $url = sprintf($path. "/feed/data.json?id=%s&start=%s&end=%s&interval=%s&skipmissing=%s&limitinterval=%s",
            $id, $start, $end, $interval, $skipmissing, $limitinterval
        );
        $input_data = json_decode(file_get_contents($url),true);
        $lastvalue = null;
        // create array with correctly formatted values
        $data = array();
        if (!isset($input_data['success'])) {
            foreach($input_data as $row){
                list($time, $value) = $row;
                $time /= 1000;
                if ($format === 'datestr') {
                    $time = date('c', $time);
                } elseif ($format === 'seconds') {
                    $time = $time - $start;
                }
                $add_data = true;
                if (is_null($value)) {
                    if ($nullvalues !== 'remove') {
                        if ($nullvalues === 'show') {
                            $value = null;
                        } elseif ($nullvalues === 'lastvalue') {
                            $value = $lastvalue;
                        }
                    } elseif ($nullvalues === 'remove') {
                        // dont add data to output
                        $add_data = false;
                    }
                } else {
                    $lastvalue = $value;
                }
                if ($add_data) $data[] = array($time, $value, $row[0]);
            }
        }

        // filename for download
        $filename = "graph_data_" . date('Ymd') . '.' . $route->format;
        header("Content-Disposition: attachment; filename=\"$filename\"");

        // @todo: multi id api endpoint for aget.json
        $url2 = sprintf($path. "/feed/aget.json?id=%s", $id);
        $meta = json_decode(file_get_contents($url2), true);
        
        // feed titles
        if (isset($meta['success'])) {
            $title = $meta['message'];
            $unit = '';
        } else {
            if ($headers === 'tags') {
                $title = $meta['tag'];
            } else {
                $title = implode(':', array($meta['tag'], $meta['name']));
            }
            $unit = $meta['unit'];
        }

        if ($route->format === 'csv') {
            if (isset($input_data['success'])) {
                return 'Error: ' . $input_data['message'];
            }
            // build csv column headings
            if ($headers!=='none') {
                if ($format === 'datestr') {
                    $col_titles[] = '"Date-time string"';
                } elseif ($format === 'seconds') {
                    $col_titles[] = '"Seconds since start"';
                } else {
                    $col_titles[] = '"Unix timestamp"';
                }
            }
            $col_titles[] = '"' . $title . ' (' . $unit . ')"';
            // join column headings with comma
            $lines[] = implode(',', $col_titles);

            // get csv data
            foreach($data as $col){
                $lines[] = implode(',', array($col[0], $col[1]));
            }

            // join all the lines with line break
            return implode("\n", $lines);
            
        } elseif($route->format === 'json') {
            if (isset($input_data['success'])) return $input_data;

            // return data as json object
            // data returned in data property
            $json['title'] = $title;
            $json['name'] = $meta['name'];
            $json['tag'] = $meta['tag'];
            $json['id'] = $meta['id'];
            $json['unit'] = $meta['unit'];
            foreach($data as $val) {
                $json['data'][] = array(
                    'timestamp'=> $val[2],
                    'formatted'=> $val[0],
                    'value'=> $val[1]
                );
            }
            return array($json);
        }
    }
    else {
        $result = view("Modules/graph/view.php", array("session" => $session["write"], 'group_support' => 0));
    }

    return array('content' => $result, 'fullwidth' => true);
}
