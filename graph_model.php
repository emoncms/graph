<?php

/*
  All Emoncms code is released under the GNU Affero General Public License.
  See COPYRIGHT.txt and LICENSE.txt.

  ---------------------------------------------------------------------
  Emoncms - open source energy visualisation
  Part of the OpenEnergyMonitor project:
  http://openenergymonitor.org
 */

// no direct access
defined('EMONCMS_EXEC') or die('Restricted access');

class Graph
{
    private $mysqli;

    public function __construct($mysqli) 
    {
        $this->mysqli = $mysqli;
    }
        
    public function create($userid,$data)
    {
        $userid = (int) $userid;
        $data = preg_replace('/[^\w\s\-.",:#&{}\[\]]/','',$data);

        $stmt = $this->mysqli->prepare("INSERT INTO graph ( userid, data ) VALUES (?,?)");
        $stmt->bind_param("is", $userid, $data);
        $stmt->execute();
        $id = $this->mysqli->insert_id;
        if ($id) return array("success"=>true, "message"=>"graph saved id:$id");
        return array("success"=>false, "message"=>"error:$id");
    }
    
    public function update($userid,$id,$data)
    {
        $userid = (int) $userid;
        $id = (int) $id;
        $data = preg_replace('/[^\w\s\-.",:#&{}\[\]]/','',$data);
        
        $result = $this->mysqli->query("SELECT data FROM graph WHERE `id`='$id' AND `userid`='$userid'");
        if ($result->num_rows) {
            $stmt = $this->mysqli->prepare("UPDATE graph SET `data`=? WHERE `id`=?");
            $stmt->bind_param("si", $data, $id);
            $stmt->execute();
            return array("success"=>true, "message"=>"updated");
        }
        return array("success"=>false, "message"=>"graph does not exist");
    }
    
    public function delete($userid,$id)
    {
        $userid = (int) $userid;
        $id = (int) $id;
        $this->mysqli->query("DELETE FROM graph WHERE `id` = '$id' AND `userid` = '$userid'");
        return array("success"=>true, "message"=>"deleted");
    }
    
    public function get($userid,$id)
    {
        $userid = (int) $userid;
        $id = (int) $id;
        $result = $this->mysqli->query("SELECT userid,data FROM graph WHERE `id`='$id'");
        if ($result->num_rows) {
            $row = $result->fetch_array();
            $data = json_decode($row['data']);
            // Check for valid decode
            if ($data==null) $data = array();
            // Check for public access
            /* Option could be used for further access control (feeds are already protected)
            if ($row['userid']!=$userid) {
                if (!isset($data->public)) 
                    return array("success"=>false, "message"=>"this graph is not public");
                if (!$data->public) 
                    return array("success"=>false, "message"=>"this graph is not public");
            }*/
            return $data;
        }
        return array("success"=>false, "message"=>"graph does not exist");
    }

    public function getall($userid)
    {
        $userid = (int) $userid;

        $graphs = array('user'=>array());

        // Get user's graphs
        $result = $this->mysqli->query("SELECT id,data FROM graph WHERE `userid`='$userid'");
        while($row = $result->fetch_array())
        {
            $data = json_decode($row['data']);
            // Check for valid decode
            if ($data!=null) {
                $data->id = $row['id'];
                $graphs['user'][] = $data;
            }
        }
        return $graphs;
    }
}
