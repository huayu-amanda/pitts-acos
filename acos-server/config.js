var CONFIG = {
    // The address for the server
    // If you are running behind a reverse proxy (e.g. nginx on port 80), set:
    //   SERVER_ADDRESS=http://<PUBLIC_IP>/
    // so that generated content URLs (html_url/protocol_urls) are correct.
    serverAddress: process.env.SERVER_ADDRESS || ('http://localhost:' + (process.env.PORT || '3000') + '/'),

    // Location for log files. The path will be relative to this directory.
    // If the path starts with a slash, it will be considered as an absolute path.
    logDirectory: 'logs',
    publicLogDirectory: 'public_logs',

    // This secret key is used to create the secret logging keys based on
    // the public logging key.
    // IMPORTANT: Change this value! It can be any string.
    logKey: 'abcdabcdabcdabcd',

    // Path for the Python 3 executable.
    // This is used, for example, by acos-python-parser
    pythonPath: '/usr/bin/python3',

    // LTI protocol keys used by acos-lti.
    // Configure via environment variables for container/local flexibility.
    ltiKeys: {
        consumerKey: process.env.LTI_CONSUMER_KEY || 'acos',
        consumerSecret: process.env.LTI_CONSUMER_SECRET || 'acos'
    },


    // If this is enabled, all installed packages are automatically
    // searched when the server starts. In order to be auto-discovered,
    // the package name must start with 'acos-'.
    autoDiscovery: true,


    // Default port used by the connect-livereload package
    connectLiveReloadPort: 35729,

    // Insert all the installed package names here to use them
    // These are ignored if autoDiscovery is true!
    installedPackages: [
        // Installed protocols
        'acos-html',
        // Installed content types
        'acos-annotated',
        // Installed content packages
        'acos-annotated-demo',
        // Tools
        'acos-logging-keygenerator',
        // Libraries
        
        // Other packages
        
    ]

};

module.exports = CONFIG;
