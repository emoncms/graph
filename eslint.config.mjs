// ESLint configuration for the module's JavaScript.
//
//     npm run lint:js
//     npm run lint:js:fix
//
// Browser scripts are classic scripts in one global scope, so every top
// level name is a global. Each file lists the names it declares below and
// no-implicit-globals reports any other, including a variable assigned
// without var. Names that other files or the PHP views read are listed
// under shared as well, readonly, so a file that reads one is not reported
// by no-undef.

import globals from "globals";
import stylistic from "@stylistic/eslint-plugin";

// Set by emoncms core, its theme and Lib scripts, the graph views or the
// dashboard module before the module scripts run.
const emoncms = {
    _Tr: "readonly",
    path: "readonly",
    apikey: "readonly",
    apikeystr: "readonly",
    feedlist: "readonly",
    feedidsLH: "readonly",
    feedidsRH: "readonly",
    graph_embed: "readonly",
    session_write: "readonly",
    load_savegraphs: "readonly",
    min_feed_interval: "readonly",
    savedgraphsnamelist: "readonly",
    menu: "readonly",
    copyToClipboardCustomMsg: "readonly",
    DateTimePicker: "readonly",
    Vue: "readonly",
    Flot: "readonly",
    // Published through window by graph.lib.js and graph.render.js
    GraphHelpers: "readonly",
    GraphChart: "readonly",
    // Widget registry of the dashboard module
    widgets: "readonly",
};

// Names read outside the file that declares them. graph.lib.js and
// graph.render.js publish through window, so only the graph page and the
// widget declare names in the shared scope.
const shared = [
    "GraphLayoutApp", "graph_widgetlist",
];

// Top level names each file declares
const declares = {
    "graph.core.js": [
        "GH", "isEmbedGraph", "hasTouchInput", "apiUrl", "getJson", "postJson", "GraphLayoutApp",
    ],
    "widget/graph_render.js": [
        "GRAPH_BAR_INSET", "graph_refresh_interval", "graph_time_ranges", "graph_widgetlist",
        "graph_widget", "graph_build", "graph_frame", "graph_toolbar", "graph_fullscreen",
        "graph_hex", "graph_background", "graph_parse_time", "graph_zoom", "graph_pan",
        "graph_saved", "graph_message", "graph_refresh", "graph_destroy",
        "graph_config_editor", "graph_config_preview_chart", "graph_config_preview_timeout",
        "graph_config_preview", "graph_config_preview_drop", "graph_saved_name",
        "graph_config_parse", "GRAPH_CONFIG_ZOOMS", "graph_config_form", "graph_config_axis",
        "graph_config_axis_auto", "graph_config_integer_keys", "graph_config_decimal_keys",
        "graph_config_navigation_key", "graph_config_label", "GRAPH_AUTO_COLOURS",
        "graph_config_feed_colour", "graph_config_feed", "graph_config_row",
        "graph_config_select", "graph_config_flag", "graph_config_check",
        "graph_config_feed_select", "graph_config_feed_lookup", "graph_config_from_saved",
    ],
};

function writable(names) {
    return Object.fromEntries(names.map((name) => [name, "writable"]));
}

function readonly(names) {
    return Object.fromEntries(names.map((name) => [name, "readonly"]));
}

export default [
    {
        ignores: ["node_modules/", "vendor/"],
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: {
                ...globals.browser,
                ...globals.jquery,
                ...emoncms,
                ...readonly(shared),
            },
        },
        plugins: {
            "@stylistic": stylistic,
        },
        rules: {
            "eqeqeq": ["warn", "always", { null: "ignore" }],
            "no-undef": "error",
            "no-implicit-globals": "error",
            "prefer-const": "error",
            "@stylistic/indent": ["error", 4, { SwitchCase: 1 }],
            "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
            "@stylistic/semi": ["error", "always"],
        },
    },
    ...Object.entries(declares).map(([file, names]) => ({
        files: [file],
        languageOptions: { globals: writable(names) },
    })),
];
