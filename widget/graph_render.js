/*
   All emon_widgets code is released under the GNU General Public License v3.
   See COPYRIGHT.txt and LICENSE.txt.

   Part of the OpenEnergyMonitor project:
   http://openenergymonitor.org

   Author: Trystan Lea: trystan.lea@googlemail.com
   If you have any questions please get in touch, try the forums here:
   http://openenergymonitor.org/emon/forum
 */

function graph_widgetlist(){
  var widgets = {
    "graph":
    {
      "offsetx":0,"offsety":0,"width":400,"height":300,
      "menu":"Visualisations",
      "options":["graphid", "lookahead"],
      "optionstype":["dropbox", "value"],
      "optionsname":[_Tr("Graph"),"Look Ahead"],
      "optionshint":[_Tr("Saved graphs from graph module"), "Hours into the future to show on the graph (optional)"],
      "optionsdata":[savedgraphsnamelist],
      "html":""
    }
  }

  return widgets;
}

function graph_init(){
  graph_draw();
}

function graph_draw(){
  var graphlist = graph_widgetlist();

  var graphclasslist = '';
  for (var z in graphlist) { graphclasslist += '.'+z+','; }
  graphclasslist = graphclasslist.slice(0, -1);

  $(graphclasslist).each(function(){
    var id = $(this).attr("id");
    var feed = $(this).attr("feed") || 0;
    var width = $(this).width();
    var height = $(this).height();

    var apikey_string = "";
    if (apikey) apikey_string = "&apikey="+apikey;

    if (!$(this).html() || reloadiframe==id || reloadiframe==-1 || apikey){
        var attrstring = "";
        var target = $(this).get(0);
        var l = target.attributes.length;
        for (var i=0; i<l; i++){
          var attr = target.attributes[i].name;
          if (attr!="id" && attr!="class" && attr!="style"){
            attrstring += "&"+attr+"="+target.attributes[i].value;
          }
        }
        pathfix=path.substr(path.indexOf('://')+3); // remove protocol
        pathfix=pathfix.substr(pathfix.indexOf('/')); // remove hostname
        
        $(this).html('<iframe frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="'+pathfix+'graph/embed'+attrstring+apikey_string+'"></iframe>');
        console.log('--> new relative url for iframe of '+ $(this).attr("class") + ': '+pathfix+'graph/embed'+attrstring+apikey_string);
    }

    var iframe = $(this).children('iframe');
    iframe.width(width);
    iframe.height(height);

  });
  // This will be triggered from the vis module on vis_draw
  // reloadiframe = 0;
}

function graph_slowupdate() {}

function graph_fastupdate() {}
