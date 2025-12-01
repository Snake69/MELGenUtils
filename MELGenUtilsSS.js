const fs = require ("fs-extra");
const path = require("path");
const http = require ("http");
const WSServer = require ("websocket").server;
const impdb = require ("./JS/ImportDB.js");
const misc = require ("./JS/misc.js");
const tl = require ("./JS/Timeline.js");
const ss = require ("./JS/Slideshow.js");
const p2p = require ("./JS/Point2Point.js");
const otd = require ("./JS/OnThisDay.js");
const cHTML = require ("./JS/CreateHTML.js");
const sia = require ("./JS/SIA.js");
const ver = require ("./JS/Verify.js");
const gedcom = require ("./JS/ImportGedcom.js");
const copydb = require ("./JS/CopyData.js");
const recur = require("./JS/Recurring.js");
const monweb = require("./JS/MonitorWeb.js");
const insp = require ("./JS/Inspect.js");
const os = require("os");

const hostname = "127.0.0.1";
const port = 3000;
var indSitesList;

global.UserPrefs;
global.OTDRecur;
global.MonURLs;
global.log;
global.errors;
global.warnings;
global.rdata;
global.tdata;
global.cntevt;
global.specialSW;
global.OTDtevnts;
global.msgs;
global.DBSysInfo;
global.familydata;
global.famindex;
global.General;
global.Births;
global.Deaths;
global.FrIndWar;
global.RevWar;
global.WarOf1812;
global.CivilWar;
global.WWI;
global.WWII;
global.KorWar;
global.VietWar;
global.EuroNA;
global.USGeo;
global.WorldGeo;
global.CanadaGeo;
global.MLB;
global.sseClients;

log = "";
misc.Logging("MELGenUtils node/server started.");
if (fs.existsSync(path.normalize("MELGenUtilsInfo.txt"))) {
    try {
        /* load info regarding MELGenUtils; it's a small file & ok to read synchronously */
        DBSysInfo = fs.readFileSync("MELGenUtilsInfo.txt", "utf8");
        DBSysInfo = DBSysInfo.replace(/\r\n/g, '\n');
        misc.Logging("Read MELGenUtilsInfo.txt \(for managing Family DataBases\) at MELGenUtils start-up.");
        if (misc.ProcessDBSysInfo ("SysLocation") != __dirname) {
            /* SysLocation has changed; probably because this is the first time running MELGenUtils on this system with
               a Family DB included */
            /* get SysLocation, always located at beginning of file */
            var datapos = DBSysInfo.indexOf("\"", 0);
            if (datapos == -1) {
                /* this should never happen */
                fs.rmSync(path.normalize(misc.ProcessDBSysInfo ("SysLocation") + "/MELGenUtilsInfo.txt"), { recursive: true, force: true });
                console.log("There is a SysLocation problem with the current MELGenUtilsInfo.txt at MELGenUtils start-up. " +
                            "Deleted the MELGenUtilsInfo.txt file. Please restart node.");
                process.exit();
            }
            datapos++;
            var secondquote = DBSysInfo.indexOf("\"", datapos);
            if (secondquote == -1) {
                /* this should never happen */
                fs.rmSync(path.normalize(misc.ProcessDBSysInfo ("SysLocation") + "/MELGenUtilsInfo.txt"), { recursive: true, force: true });
                console.log("There is a SysLocation problem with the current MELGenUtilsInfo.txt at MELGenUtils start-up. " +
                            "MELGenUtilsInfo.txt file deleted. Please restart node.");
                process.exit();
            }
            DBSysInfo = DBSysInfo.substring(0, datapos) + __dirname + DBSysInfo.substring(secondquote);
            try {
                /* write MELGenUtilsInfo.txt */
                fs.writeFileSync("MELGenUtilsInfo.txt", DBSysInfo);
                misc.Logging("Change in SysLocation, MELGenUtilsInfo.txt written.");
            }
            catch (err) {
                fs.rmSync(path.normalize(misc.ProcessDBSysInfo ("SysLocation") + "/MELGenUtilsInfo.txt"), { recursive: true, force: true });
                console.log(err + "; problem writing new MELGenUtilsInfo.txt file after change in SysLocation. " +
                                  "Deleted the current MELGenUtilsInfo.txt file. Please restart node.");
                process.exit();
            }
        }
    }
    catch (err) {
        fs.rmSync(path.normalize(misc.ProcessDBSysInfo ("SysLocation") + "/MELGenUtilsInfo.txt"), { recursive: true, force: true });
        console.log(err + "; problem reading MELGenUtilsInfo.txt at MELGenUtils start-up. Deleted the current MELGenUtilsInfo.txt file. " +
                    "Please restart node.");
        process.exit();
    }
} else {
    /* create MELGenUtilsInfo.txt file */
    DBSysInfo = "SysLocation = \"" + __dirname + "\"" + os.EOL;

    var DirRef = path.join(misc.ProcessDBSysInfo ("SysLocation"), "DBs");
    if (fs.existsSync(DirRef))
        fs.readdirSync(DirRef).forEach(file => {
            if (file.indexOf("BACKUP") == -1) {             // ignore backups
                // determine if Gedcom or user-created format
                var DirPTRef = path.join(DirRef, file, "PlainText"), Fged = ".GED", whichFormat;
                whichFormat = 'U';
                fs.readdirSync(DirPTRef).forEach(file => {
                    if (Fged === file.slice(-4).toUpperCase())
                        whichFormat = 'G';
                })
                DBSysInfo += os.EOL + 'DBActive = "no"' + os.EOL + 'DBName = "' + file + '"' + os.EOL + 'DBUserID = ""' + os.EOL +
                             'DBStatus = "0"' + os.EOL + 'DBFormat = "' + whichFormat + '"' + os.EOL + 'DBSecurity = "0"' + os.EOL +
                             'DBLocation = "DBs/' + file + '"' + os.EOL;
            }
        })
    DBSysInfo += os.EOL;

    try {
        /* write MELGenUtilsInfo.txt */
        fs.writeFileSync("MELGenUtilsInfo.txt", DBSysInfo);
        misc.Logging("Initial MELGenUtilsInfo.txt written.");
    }
    catch (err) {
        console.log(err + "; problem writing initial MELGenUtilsInfo.txt file. Try restarting node.");
        process.exit();
    }
}

try {
    /* load contents of individual sites list file; it's a small file & ok to read synchronously */
    indSitesList = fs.readFileSync(path.join("Include", "SiteList.txt"), "utf8");
    indSitesList = indSitesList.replace(/\r\n/g, ',');
    indSitesList = indSitesList.replace(/\n/g, ',');
    misc.Logging("Read SiteList.txt \(for searching\) at MELGenUtils start-up.");
}
catch (err) {
    misc.Logging("Could not read SiteList.txt file at MELGenUtils start-up. \(" + err + "\)");
    indSitesList = '';
}

try {
    /* recurring On This Day Reports */
    OTDRecur = JSON.parse(fs.readFileSync(path.join("UserFiles", "OTDRecur.json"), "utf8"));
    misc.Logging("Read OTDRecur.json \(for recurring reports\) at MELGenUtils start-up.");
}
catch (err) {
    misc.Logging("Could not read OTDRecur.json at MELGenUtils start-up. \(" + err + "\)");
    OTDRecur = [{}];
    OTDRecur.length = 0;
}
/* initiate recurring On This Day Reports */
for (var x = 0; x < Object.keys(OTDRecur).length; x++)
    if (OTDRecur[x].active == '1')
        recur.setCron(OTDRecur[x]);

try {
    /* URLs being monitored */
    MonURLs = JSON.parse(fs.readFileSync(path.join("UserFiles", "MonitorURLs.json"), "utf8"));
    misc.Logging("Read MonitorURLs.json \(for URLs being monitored\) at MELGenUtils start-up.");
}
catch (err) {
    misc.Logging("Could not read MonitorURLs.json at MELGenUtils start-up. \(" + err + "\)");
    MonURLs = [{}];
    MonURLs.length = 0;
}
/* initiate monitoring URLs */
for (var x = 0; x < Object.keys(MonURLs).length; x++)
    if (MonURLs[x].Active == '0')
        monweb.setCronMon(MonURLs[x]);

try {
    /* User Preferences */
    UserPrefs = JSON.parse(fs.readFileSync(path.join("UserFiles", "UserPreferences.json"), "utf8"));
    misc.Logging("Read UserPreferences.json at MELGenUtils start-up.");
    if (UserPrefs.FamDB != "NoAction") {
        /* User Preferences setting takes precedence */
        var TInfo = DBSysInfo;

        /* first, deactivate currently active DB (if there is one) */
        var activepos = DBSysInfo.indexOf("DBActive = \"yes\"", 0);
        if (activepos !== -1) {
            activepos += 12;
            DBSysInfo = DBSysInfo.substring(0, activepos) + 'no"' + DBSysInfo.substring(activepos + 4);
        }

        /* activate new DB; 'None' indicates to leave all DBs inactive */
        if (UserPrefs.FamDB != "None") {
            var dbnamepos = DBSysInfo.indexOf('DBName = "' + UserPrefs.FamDB + '"', 0);
            dbnamepos -= 4;
            DBSysInfo = DBSysInfo.substring(0, dbnamepos) + "yes" + DBSysInfo.substring(dbnamepos + 2);
        }

        if (TInfo != DBSysInfo) {
            /* DBSysInfo changed; write it */
            try {
                fs.writeFileSync("MELGenUtilsInfo.txt", DBSysInfo);
                misc.Logging("Change in DB activation status per User Preferences, MELGenUtilsInfo.txt written.");
            }
            catch (err) {
                misc.Logging(err + "; problem writing MELGenUtilsInfo.txt after change in DB activation status per User Preferences.");
            }

            if (UserPrefs.FamDB != "None")
                misc.Logging('Family DataBase "' + UserPrefs.FamDB + '" activated per User Preferences.');
            else
                misc.Logging("No Family DataBase now active per User Preferences.");
            familydata = "";      // new DB active, clear Family Data area
        }
    }
}
catch (err) {
    misc.Logging("Could not read UserPreferences.json at MELGenUtils start-up. \(" + err + "\)");
    UserPrefs = [];
    UserPrefs.length = 0;
}

familydata = "";
famindex = "";
General = "";
Births = "";
Deaths = "";
FrIndWar = "";
RevWar = "";
WarOf1812 = "";
CivilWar = "";
WWI = "";
WWII = "";
KorWar = "";
VietWar = "";
EuroNA = "";
USGeo = "";
WorldGeo = "";
CanadaGeo = "";
MLB = "";
specialSW = 0;
sseClients = [];

const server = http.createServer(function(req, res) {
    /* Handle SSE requests */
    if (req.url === '/events' && req.method === 'GET') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const clientId = Date.now();
        const newClient = { id: clientId, res };
        sseClients.push(newClient);
        misc.Logging(`SSE Client ${clientId} connected.`);

        req.on('close', () => {
            sseClients = sseClients.filter(client => client.id !== clientId);
            misc.Logging(`SSE Client ${clientId} disconnected.`);
        })
    } else {
        res.writeHead(404);
        res.end();
    }
}).listen(port, hostname);

var tLog;
server.on("connection", (socket) => { 
    var clientAddress = `${socket.remoteAddress}:${socket.remotePort}`; 
    tLog = `Request from ${clientAddress}`;             // tLog appended continued below
})

/* create web socket server on top of the http server */
const ws = new WSServer({
    httpServer: server
})

ws.on("request", function (request) {
    const connection = request.accept(null, request.origin);

    connection.on("message", async function (message) {
        let fetchPromise = Promise.resolve();         // Default to a resolved promise

        if (message.utf8Data == "DateAgeCalc") {
            misc.Logging(tLog + " to perform Date/Age Calculation (not a server function)."); 
        }
        if (message.utf8Data == "DayOfWeek") {
            misc.Logging(tLog + " to perform Day of Week Calculation (not a server function)."); 
        }
        if (message.utf8Data == "MoneyConversion") {
            misc.Logging(tLog + " to perform Money Value Conversion (not a server function)."); 
        }
        if (message.utf8Data == "MapDeed") {
            misc.Logging(tLog + " to Map Deed Boundaries (not a server function)."); 
        }
        if (message.utf8Data == "DBLocation") {
            misc.Logging(tLog + " for location of active Family DataBase."); 
            var DBLocation = misc.ProcessDBSysInfo ("DBLocation");
            connection.sendUTF(path.normalize(DBLocation));
        }
        if (message.utf8Data == "SysLocation") {
            misc.Logging(tLog + " for location of MELGenUtils."); 
            var SysLocation = misc.ProcessDBSysInfo ("SysLocation");
            connection.sendUTF(path.normalize(SysLocation));
        }
        if (message.utf8Data == "DBName") {
            misc.Logging(tLog + " for name of active Family DataBase."); 
            var DBName = misc.ProcessDBSysInfo ("DBName");
            connection.sendUTF(DBName);
        }
        if (message.utf8Data == "ID") {
            misc.Logging(tLog + " for Focus ID in active Family DataBase."); 
            var userID = misc.ProcessDBSysInfo ("ID");
            connection.sendUTF(userID);
        }
        if (message.utf8Data == "DBStatus") {
            misc.Logging(tLog + " for status of active Family DataBase."); 
            var DBStatus = misc.ProcessDBSysInfo ("DBStatus");
            connection.sendUTF(DBStatus);
        }
        if (message.utf8Data == "DBFormat") {
            misc.Logging(tLog + " for format of active Family DataBase."); 
            var DBFormat = misc.ProcessDBSysInfo ("DBFormat");
            connection.sendUTF(DBFormat);
        }
        if (message.utf8Data == "DBInfo") {
            misc.Logging(tLog + " for active Family DataBase info."); 
            var DBInfo = misc.DBInfo ();
            connection.sendUTF(DBInfo);
        }
        if (message.utf8Data == "DBIndexExist") {
            misc.Logging(tLog + " to ascertain existence of an index for active Family DataBase."); 
            var DBindex = path.join(misc.ProcessDBSysInfo ("DBLocation"), "/PlainText/index");
            if (!fs.existsSync(DBindex))
                connection.sendUTF("NO");
            else
                connection.sendUTF("YES");
        }
        if (message.utf8Data == "DBHTMLExist") {
            misc.Logging(tLog + " to ascertain existence of a HTML version of the active Family DataBase."); 
            var DBHTML = path.join(misc.ProcessDBSysInfo ("DBLocation"), "/HTML/tableofcontents.html");
            if (!fs.existsSync(DBHTML))
                connection.sendUTF("NO");
            else
                connection.sendUTF("YES");
        }
        if (message.utf8Data.substring(0,9) == "DBDoIndex") {
            misc.Logging(tLog + " to create an index for active Family DataBase."); 
            misc.ReadFamilyDB();
            var DBIndex = misc.DBIndex (message.utf8Data.substring(9));
            connection.sendUTF(DBIndex);
        }
        if (message.utf8Data.substring(0,11) == "ValidateURL") {
            misc.Logging(tLog + " to validate URL & get hash.");
            const urlToFetch = message.utf8Data.substring(11);

            fetchPromise = fetch(urlToFetch, {
                /* some sites (familysearch.org for one) need this dummy header */
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            })
            .then(response => {
                if (!response.ok) {
                    connection.sendUTF("failed");
                    throw new Error(`Network response was not ok: ${response.status}`); // Throw to prevent further chaining in case of failure
                }
                return response.text();
            })
            .then(responseData => {
                connection.sendUTF(monweb.calculateHash(responseData));
            })
            .catch(error => {
                connection.sendUTF("failed");
            })

            await fetchPromise;  // Wait for fetch to complete
        }
        if (message.utf8Data == "GetRecur") {
            misc.Logging(tLog + " for recurring reports parameters."); 
            connection.sendUTF(JSON.stringify(OTDRecur));
        }
        if (message.utf8Data == "GetUserPrefs") {
            misc.Logging(tLog + " for User Preferences."); 
            connection.sendUTF(JSON.stringify(UserPrefs));
        }
        if (message.utf8Data == "GetMonURLs") {
            misc.Logging(tLog + " for URLs Being Monitored."); 
            connection.sendUTF(JSON.stringify(MonURLs));
        }
        if (message.utf8Data.substring(0,11) == "GetFamGroup") {
            misc.Logging(tLog + " to get a Family Group."); 
            var ID = message.utf8Data.substring(11), FamGroup = '';
            misc.ReadFamilyDB();
            var nmpos = familydata.indexOf(os.EOL + ID + "  ");
            if (nmpos != -1)
                nmpos++;
            FamGroup = familydata.substring(nmpos, familydata.indexOf(os.EOL + os.EOL + os.EOL, nmpos));
            if (FamGroup == '')
                connection.sendUTF("NOTFOUND");
            else
                connection.sendUTF(FamGroup);
        }
        if (message.utf8Data.substring(0,10) == "WriteRecur") {
            var OTDTRecur = [{}];
            OTDTRecur.length = 0;
            misc.Logging(tLog + " to write recurring reports parameters."); 
            OTDTRecur = JSON.parse(message.utf8Data.substring(11));
            misc.dirExist("UserFiles");
            try {
                fs.writeFileSync(path.join("UserFiles", "OTDRecur.json"), JSON.stringify(OTDTRecur, null, 2));
                var result = '';
                misc.Logging("Saved Recurring On This Day Report parameter file.");
                Object.keys(OTDRecur).length = 0;
                OTDRecur = deepCopy (OTDTRecur);
                recur.killAllCronJobs();      // kill all cron jobs currently running
                /* [re]initiate recurring On This Day Reports */
                for (var x = 0; x < Object.keys(OTDRecur).length; x++)
                    if (OTDRecur[x].active == '1')
                        recur.setCron(OTDRecur[x]);
                /* since ALL cron jobs were killed, need to [re]initiate URL monitoring cron jobs as well */
                for (var x = 0; x < Object.keys(MonURLs).length; x++)
                    if (MonURLs[x].Active == '0')
                        monweb.setCronMon(MonURLs[x], sseClients);
            }
            catch (err) {
                var result = 'failed';
                misc.Logging("Could not save Recurring On This Day Report parameter file. \(" + err + "\)");
            }
            connection.sendUTF(result);
        }
        if (message.utf8Data.substring(0,12) == "WriteMonURLs") {
            var MonTURLs = [{}];
            MonTURLs.length = 0;
            misc.Logging(tLog + " to write URLs being monitored."); 
            MonTURLs = JSON.parse(message.utf8Data.substring(12));
            misc.dirExist("UserFiles");
            try {
                fs.writeFileSync(path.join("UserFiles", "MonitorURLs.json"), JSON.stringify(MonTURLs, null, 2));
                var result = '';
                misc.Logging("Saved file for URLs being monitored.");
                Object.keys(MonURLs).length = 0;
                MonURLs = deepCopy (MonTURLs);
                recur.killAllCronJobs();      // kill all cron jobs currently running
                /* [re]initiate URL monitoring */
                for (var x = 0; x < Object.keys(MonURLs).length; x++)
                    if (MonURLs[x].Active == '0')
                        monweb.setCronMon(MonURLs[x], sseClients);
                /* since ALL cron jobs were killed, need to [re]initiate recurring On This Day Reports as well */
                for (var x = 0; x < Object.keys(OTDRecur).length; x++)
                    if (OTDRecur[x].active == '1')
                        recur.setCron(OTDRecur[x]);
            }
            catch (err) {
                var result = 'failed';
                misc.Logging("Could not save file for monitoring URLs. \(" + err + "\)");
            }
            connection.sendUTF(result);
        }
        if (message.utf8Data.substring(0,14) == "WriteUserPrefs") {
            var UserTPrefs = {};
            UserTPrefs.length = 0;
            misc.Logging(tLog + " to write User Preferences."); 
            UserTPrefs = JSON.parse(message.utf8Data.substring(15));
            misc.dirExist("UserFiles");
            try {
                fs.writeFileSync(path.join("UserFiles", "UserPreferences.json"), JSON.stringify(UserTPrefs, null, 2));
                var result = '';
                misc.Logging("Saved User Preferences.");
                UserPrefs = UserTPrefs;
            }
            catch (err) {
                var result = 'failed';
                misc.Logging("Could not save User Preferences. \(" + err + "\)");
            }
            connection.sendUTF(result);
        }
        if (message.utf8Data == "DBActiveInfo") {
            misc.Logging(tLog + " for info of active DB from MELGenUtilsInfo.txt file."); 
            var pnt1 = DBSysInfo.indexOf('DBActive = "yes"');
            var pnt2 = DBSysInfo.indexOf("\n\n", pnt1) + 1;
            connection.sendUTF(DBSysInfo.substring(pnt1, pnt2));
        }
        if (message.utf8Data == "GetGenNotes") {
            misc.Logging(tLog + " to get General Notes."); 
            try {
                var GenNotes = fs.readFileSync(path.join("UserFiles", "GenNotes.txt"), "utf8");
                misc.Logging("Read General Notes.");
            }
            catch (err) {
                var GenNotes = '';
            }
            connection.sendUTF(GenNotes);
        }
        if (message.utf8Data.substring(0,12) == "PutGenNotes ") {
            misc.Logging(tLog + " to write General Notes."); 
            misc.dirExist("UserFiles");
            try {
                fs.writeFileSync(path.join("UserFiles", "GenNotes.txt"), message.utf8Data.substring(12));
                var result = '';
                misc.Logging("Saved General Notes.");
            }
            catch (err) {
                var result = 'failed';
            }
            connection.sendUTF(result);
        }
        if (message.utf8Data == "GetActDBNotes") {
            misc.Logging(tLog + " to get Notes for Active DataBase."); 
            try {
                var ActDBNotes = fs.readFileSync(path.join(misc.ProcessDBSysInfo ("DBLocation"),
                                                 "Other", "UserDBNotes.txt"), "utf8");
                misc.Logging("Read Notes for Active DataBase.");
            }
            catch (err) {
                var ActDBNotes = '';
            }
            connection.sendUTF(ActDBNotes);
        }
        if (message.utf8Data.substring(0,14) == "PutActDBNotes ") {
            misc.Logging(tLog + " to write Notes for Active DataBase."); 
            try {
                fs.writeFileSync(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Other", "UserDBNotes.txt"),
                                 message.utf8Data.substring(14));
                var result = '';
                misc.Logging("Saved Notes for Active DataBase.");
            }
            catch (err) {
                var result = 'failed';
            }
            connection.sendUTF(result);
        }
        if (message.utf8Data == "ViewLog") {
            misc.Logging(tLog + " for contents of MELGenUtils log."); 
            connection.sendUTF('<!doctype html> <html lang="en"><head> <meta charset="utf-8"/> <link rel="shortcut icon" ' +
                               'href="Include/favicon.ico"> <title> Log Messages </title>' + '</head> <body id="Body"> ' +
                               "<style type='text/css'> @media print { @page { margin-left: 0.5in; margin-right: 0.5in; " +
                               "margin-top: 0; margin-bottom: 0; } #printPB { display: none; } } </style> <pre>" + os.EOL +
                                log + os.EOL + "</pre> <script type=\"text/javascript\" src=\"clib.js\"></script> " +
                               "<button id='printPB'" + " onclick='userPrint(\"Log\")'>Print Log</button> </body> </html>");
        }
        if (message.utf8Data == "INDSITES") {
            misc.Logging(tLog + " for contents of SiteList.txt file."); 
            // don't send the final character (always a comma)
            connection.sendUTF(indSitesList.substring(0, indSitesList.length - 1));
        }
        if (message.utf8Data == "AllDBNameDBActive") {
            misc.Logging(tLog + " for all Family DataBase names and associated activation status."); 
            var AllDBNameDBActive = misc.ProcessDBSysInfo ("AllDBNameDBActive");
            connection.sendUTF(AllDBNameDBActive);
        }
        if (message.utf8Data == "AllDBNames") {
            misc.Logging(tLog + " for all Family DataBase names."); 
            var AllDBNames = misc.ProcessDBSysInfo ("AllDBNames");
            connection.sendUTF(AllDBNames);
        }
        if (message.utf8Data.substring(0,15) == "PerformImportDB") {
            misc.Logging(tLog + " to perform the import of a Family DataBase."); 
            if (specialSW == -69) {
                connection.sendUTF("No data to import (perhaps due to a lack of sourcing). Import of DataBase not performed.<br> <br>");
                specialSW = 0;
            }
            else {
                var ImportRes = impdb.PerformImportDB (message.utf8Data.substring(16, message.utf8Data.length));
                if (ImportRes == -1)
                    connection.sendUTF("Import of DataBase failed. " +
                                       "For fatal issue, see 'Miscellaneous Functions -> MELGenUtils Log Messages'.<br> <br>");
                else
                    connection.sendUTF("Import of DataBase successful.<br> <br>");
            }
        }
        if (message.utf8Data == "PreCreateHTML") {
            misc.Logging(tLog + " to pre-check for creating the HTML version of the active Family DataBase."); 

            const HTMLerrs = cHTML.CreateHTML ();

            if (HTMLerrs === "") {
                /* ask user whether or not to continue create */
                var DBLocation = misc.ProcessDBSysInfo ("DBLocation");
                var DBName = misc.ProcessDBSysInfo ("DBName");
                connection.sendUTF("No fatal errors.<br> <br>A HTML version of the DataBase '" +
                                    DBName + "' will be created and stored in " + path.join(DBLocation, "HTML") + "<br> <br>" +
                                   "Click \"OK\" to continue with the creation or \"Cancel\" to abort.<br> <br>");
            } else
                /* errors are present, do not continue with creating the HTML Family DB */
                connection.sendUTF(HTMLerrs + "<br> <br>");
        }
        if (message.utf8Data.substring(0,12) == "DoCreateHTML") {
            misc.Logging(tLog + " to create an HTML version of the active Family DataBase."); 
            var CreateHTMLRes = cHTML.DoCreateHTML ();
            if (CreateHTMLRes == -1)
                connection.sendUTF("Creation of HTML version of DataBase successful,<br>however some IDs were not able to be wrapped " +
                                   "in HTML.<br>For details, see 'Miscellaneous Functions -> MELGenUtils Log Messages'.<br> <br>");
            else
                connection.sendUTF("Creation of HTML version of DataBase successful.<br>For details, see " +
                                   "'Miscellaneous Functions -> MELGenUtils Log Messages'.<br> <br>");
        }
        if (message.utf8Data.substring(0,8) == "ChkLinks") {
            misc.Logging(tLog + " to check Web links in the active Family DataBase."); 
            misc.ReadFamilyDB();

            const chkResult = await misc.ChkLinks();

            if (chkResult.startsWith("ERRORS "))
                /* errors are present */
                connection.sendUTF(chkResult.substring(7) + "<br> <br>");
            else
                if (chkResult != "")
                    connection.sendUTF(chkResult);
                else
                    connection.sendUTF("No links found for checking.<br> <br>");
        }
        if (message.utf8Data.substring(0,6) == "VERIFY") {
            misc.Logging(tLog + " to verify the active Family DataBase."); 

            const verResult = await ver.Verify (message.utf8Data[6], message.utf8Data[7], message.utf8Data.substring(8));

            if (verResult.startsWith("ERRORS "))
                /* errors are present */
                connection.sendUTF(verResult.substring(7) + "<br> <br>");
            else
                if (verResult != "")
                    connection.sendUTF(verResult);
                else
                    connection.sendUTF("No data for Verify.<br> <br>");
        }
        if (message.utf8Data.substring(0,7) == "INSPECT") {
            misc.Logging(tLog + " to inspect the active Family DataBase."); 

            const insResult = await insp.Inspect ();

            if (insResult.startsWith("ERRORS "))
                /* errors are present, do not continue with the Inspection */
                connection.sendUTF(insResult.substring(7) + "<br> <br>");
            else
                if (insResult != "")
                    connection.sendUTF(insResult);
                else
                    connection.sendUTF("No data for Inspect.<br> <br>");
        }
        if (message.utf8Data.substring(0,9) == "OnThisDay") {
            misc.Logging(tLog + " for an On This Day Report.");
            errors = "";
            info = "";
            warnings = "";
            msgs = "";
            rdata = "";

            otd.OnThisDay (JSON.parse(message.utf8Data.substring(9)));
            if (errors !== "")
                /* errors are present, do not continue with creating the On This Day Report */
                connection.sendUTF(errors + "<br> <br>");
            else
                if (rdata != "")
                    connection.sendUTF(rdata);
                else
                    connection.sendUTF("No data for On This Day.<br> <br>");
        }
        if (message.utf8Data.substring(0,18) == "RecurringOnThisDay") {
            if (message.utf8Data.indexOf("ManageRR") == -1)
                misc.Logging(tLog + " for a Recurring On This Day Report.");
            else
                misc.Logging(tLog + " to check edited Recurring On This Day Report.");
            errors = "";
            info = "";
            warnings = "";
            msgs = "";
            rdata = "";

            var OTDRes = '';
            OTDRes = await otd.OnThisDay(JSON.parse(message.utf8Data.substring(18)), "RECUR")
                .then(() => {
                    if (OTDRes.startsWith("ERRORS "))
                        connection.sendUTF(OTDRes.substring(7) + "<br> <br>");
                    else {
                        recur.killAllCronJobs();      // kill all cron jobs currently running
                        /* [re]initiate recurring On This Day Reports */
                        for (var x = 0; x < Object.keys(OTDRecur).length; x++)
                            if (OTDRecur[x].active == '1')
                                recur.setCron(OTDRecur[x]);
                        /* since ALL cron jobs were killed, need to [re]initiate URL monitoring cron jobs as well */
                        for (var x = 0; x < Object.keys(MonURLs).length; x++)
                            if (MonURLs[x].Active == '0')
                                monweb.setCronMon(MonURLs[x], sseClients);
                        connection.sendUTF("On This Day Report Established");
                    }
                })
                .catch((error) => {
                    const OTDRes2 = (error + ", Could not verify connection to Relay Host.<br>\(i.e., Something is " +
                                     "wrong/incorrect with Relay Host and/or Login and/or Password and/or Port.\)<br> <br>");
                    connection.sendUTF(OTDRes2);
                })
        }
        if (message.utf8Data.substring(0,8) == "Timeline") {
            misc.Logging(tLog + " for a Timeline Report."); 

            const TLRep = await tl.Timeline (JSON.parse(message.utf8Data.substring(8)));

            if (TLRep.startsWith("ERRORS "))
                /* errors are present, do not continue with creating the Timeline Report */
                connection.sendUTF(TLRep.substring(7) + "<br> <br>");
            else
                if (TLRep != "")
                    connection.sendUTF(TLRep);
                else
                    connection.sendUTF("No data for Timeline.<br> <br>");
        }
        if (message.utf8Data.substring(0,9) == "Slideshow") {
            misc.Logging(tLog + " to pre-check for a Slideshow."); 

            const resSS = ss.Slideshow (JSON.parse(message.utf8Data.substring(9)));

            if (resSS.startsWith("ERRORS "))
                /* errors are present, do not do the Slideshow */
                connection.sendUTF(resSS.substring(7) + "<br> <br>");
            else
                if (resSS != "")
                    connection.sendUTF(resSS);
                else
                    connection.sendUTF("No images for Slideshow.<br> <br>");
        }
        if (message.utf8Data.substring(0,11) == "DoSlideshow") {
            misc.Logging(tLog + " to perform a Slideshow."); 
            const imagePaths = [];
            const directories = [];
            var postdata = JSON.parse(message.utf8Data.substring(11));

            imagePaths.length = directories.length = 0;
            if (postdata.hasOwnProperty('Bio'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Biographies"));
            if (postdata.hasOwnProperty('Maps'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Maps"));
            if (postdata.hasOwnProperty('Misc'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Misc"));
            if (postdata.hasOwnProperty('NewsDeaths'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Newspapers", "Deaths"));
            if (postdata.hasOwnProperty('NewsBirths'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Newspapers", "Births"));
            if (postdata.hasOwnProperty('NewsMarrs'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Newspapers", "Marriages"));
            if (postdata.hasOwnProperty('NewsOth'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Newspapers", "Misc"));
            if (postdata.hasOwnProperty('People'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "People"));
            if (postdata.hasOwnProperty('RecsAF'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Records", "ArmedForces"));
            if (postdata.hasOwnProperty('RecsBap'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Records", "Baptisms"));
            if (postdata.hasOwnProperty('RecsBible'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Records", "Bible"));
            if (postdata.hasOwnProperty('RecsBirth'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Records", "Births"));
            if (postdata.hasOwnProperty('RecsCensus'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Records", "Census"));
            if (postdata.hasOwnProperty('RecsDeath'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Records", "Deaths"));
            if (postdata.hasOwnProperty('RecsDeed'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Records", "Deeds"));
            if (postdata.hasOwnProperty('RecsMarr'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Records", "Marriages"));
            if (postdata.hasOwnProperty('RecsWill'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Records", "Wills"));
            if (postdata.hasOwnProperty('RecsOth'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Records", "Misc"));
            if (postdata.hasOwnProperty('Headstones'))
                directories.push(path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images", "Misc", "Headstones"));

            directories.forEach(directory => {
                if (fs.existsSync(directory)) {
                    const files = fs.readdirSync(directory).filter(file => file.endsWith(".jpg") || file.endsWith(".pdf"));
                    files.forEach(file => {
                        imagePaths.push(path.join(directory, file));
                    })
                }
            })
            connection.sendUTF(imagePaths);
        }
        if (message.utf8Data.substring(0,11) == "Point2Point") {
            misc.Logging(tLog + " for a Point to Point Ancestral Line Report."); 

            const PPresult = await p2p.Point2Point (JSON.parse(message.utf8Data.substring(11)));

            if (PPresult.startsWith("ERRORS "))
                /* errors are present, do not continue with creating the Point to Point Report */
                connection.sendUTF(PPresult.substring(7) + "<br> <br>");
            else
                if (PPresult != "")
                    connection.sendUTF(PPresult);
                else
                    connection.sendUTF("No data for Point to Point Ancestral Line.<br> <br>");
        }
        if (message.utf8Data.substring(0,6) == "SEARCH") {
            misc.Logging(tLog + " for a Search."); 

            const Sresult = await sia.Search (JSON.parse(message.utf8Data.substring(6)));

            if (Sresult.startsWith("ERRORS "))
                /* errors are present, abort Search */
                connection.sendUTF(Sresult.substring(7) + "<br> <br>");
            else
                if (Sresult != "")
                    connection.sendUTF(Sresult);
                else
                    connection.sendUTF("Nothing found for Search.<br> <br>");
        }
        if (message.utf8Data.substring(0,11) == "PreCopyData") {
            misc.Logging(tLog + " to pre-check for copying the active Family DataBase."); 

            const CDBres = await copydb.CopyDB (JSON.parse(message.utf8Data.substring(11)));

            if (CDBres.startsWith("ERRORS "))
                /* errors are present, do not continue with copying */
                connection.sendUTF(CDBres.substring(7) + "<br> <br>");
            else
                /* ask user whether or not to continue copy */
                connection.sendUTF("No fatal errors.<br> <br>" + CDBres + "<br> <br>" +
                                   "Click \"OK\" to continue with the copy or \"Cancel\" to abort.<br> <br>");
        }
        if (message.utf8Data.substring(0,8) == "DoCopyDB") {
            misc.Logging(tLog + " to copy the active Family DataBase."); 
            var CopyDB = copydb.DoCopyDB ();
            if (CopyDB == -1)
                connection.sendUTF("Copying of Family Data failed.<br> <br>");
            else
                connection.sendUTF("Copying of Family Data successful.<br> <br>");
        }
        if (message.utf8Data.substring(0,10) == "SetFocusID") {
            misc.Logging(tLog + " to pre-check for setting Focus ID for the active Family DataBase."); 

            const SetFres = await misc.PreSetFocusID (message.utf8Data.substring(10));

            if (SetFres.startsWith("ERRORS "))
                /* errors are present, abort */
                connection.sendUTF(SetFres.substring(7) + "<br> <br>");
            else
                if (SetFres != "")
                    connection.sendUTF(SetFres + "<br> <br>");
                else
                    connection.sendUTF(SetFres);
        }
        if (message.utf8Data.substring(0,7) == "DoSetID") {
            misc.Logging(tLog + " to set Focus ID for the active Family DataBase."); 
            if (misc.DoSetFocusID (message.utf8Data.substring(7)) == -1)
                connection.sendUTF("Focus ID in active Family DataBase not changed.<br> <br>");
            else
                connection.sendUTF("Focus ID in active Family DataBase successfully set to '" + message.utf8Data.substring(7) + "'.<br> <br>");
        }
        if (message.utf8Data.substring(0,8) == "ImportDB" || message.utf8Data.substring(0,8) == "ImportGC") {
            var Tpd = JSON.parse(message.utf8Data.substring(8)), Tmsg = "";
            var Rmsgs = [];

            if (message.utf8Data.substring(0,8) == "ImportDB")
                Rmsgs = await impdb.ImportDB (Tpd);
            else
                Rmsgs = await gedcom.GedChecks (Tpd);

            if (Rmsgs[0] == '') {
                /* ask user whether or not to continue import */
                Tmsg += "No fatal errors.<br> <br>" + Rmsgs[1] + "DataBase " + Tpd.db_name +
                        " will be imported and stored in " + "DBs/" + Tpd.db_name + "<br> <br>";
                Tmsg += "Click \"OK\" to continue the import or \"Cancel\" to abort the import.<br> <br>";
                connection.sendUTF(Tmsg);
            } else
                /* errors are present, do not continue with import */
                connection.sendUTF(Rmsgs[0]);
        }
        if (message.utf8Data.substring(0,6) == "FEXIST") {
            var fname = message.utf8Data.substring(6);
            misc.Logging(tLog + " to ascertain the existence of " + path.normalize(fname) + "."); 
            if (!fs.existsSync(path.normalize(fname))) {
                misc.Logging("'" + path.normalize(fname) + "' doesn't exist.");
                connection.sendUTF("-1");
            } else
                connection.sendUTF(path.normalize(fname));           // file exists; return normalized (cross-platform) path
        }
        if (message.utf8Data.substring(0,14) == "ChangeActiveDB") {
            misc.Logging(tLog + " to change Family DataBase activation status."); 
            const params = message.utf8Data.split(",");

            /* first, deactivate currently active DB (if there is one) */
            var activepos = DBSysInfo.indexOf("DBActive = \"yes\"", 0);
            if (activepos !== -1) {
                activepos += 12;
                DBSysInfo = DBSysInfo.substring(0, activepos) + 'no"' + DBSysInfo.substring(activepos + 4);
            }

            /* activate new DB; '999' indicates to leave all DBs inactive */
            if (params[1] != "999") {
                var dbnamepos = DBSysInfo.indexOf('DBName = "' + params[1] + '"', 0);
                dbnamepos -= 4;
                DBSysInfo = DBSysInfo.substring(0, dbnamepos) + "yes" + DBSysInfo.substring(dbnamepos + 2);
            }

            try {
                /* write MELGenUtilsInfo.txt */
                fs.writeFileSync("MELGenUtilsInfo.txt", DBSysInfo);
                misc.Logging("Change in DB activation status, MELGenUtilsInfo.txt written.");
            }
            catch (err) {
                misc.Logging(err + "; problem writing MELGenUtilsInfo.txt after change in DB activation status.");
            }

            if (params[1] != "999") {
                var sendback = params[1] + " is now active.";
                misc.Logging('Family DataBase "' + params[1] + '" activated.');
            } else {
                var sendback = "No DataBase is now active.";
                misc.Logging("No Family DataBase now active.");
            }
            familydata = "";      // new DB active, clear Family Data area
            connection.sendUTF(sendback + "<br> <br>");
        }
        if (message.utf8Data.substring(0,9) == "CreateGED") {
            misc.Logging(tLog + " import the Gedcom."); 
            var Tpd = JSON.parse(message.utf8Data.substring(9));
            var sendback = gedcom.createFiles (Tpd);
            if (sendback == '')
                connection.sendUTF("Gedcom import successful.<br> <br>");
            else
                connection.sendUTF(sendback + "<br> <br>");
        }
    })
})

/* copy nested object */
function deepCopy(obj) {
    if (typeof obj !== 'object' || obj === null)
        return obj;

    const newObj = Array.isArray(obj) ? [] : {};

    for (const key in obj)
        if (obj.hasOwnProperty(key))
            newObj[key] = deepCopy(obj[key]);

    return newObj;
}

