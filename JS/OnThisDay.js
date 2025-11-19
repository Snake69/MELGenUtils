const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const misc = require ("./misc.js");
const nodemailer = require('nodemailer');

var nonfamdbinfo, OTDwarn = '';

async function OnThisDay (postdata, ind) {
    /* user wants to create an On This Day Report */
    /* check Month & Day */
    if (postdata.Month == "" || postdata.Day == "")
        errors += "Both Month and Day are required.<br> <br>";
    if (postdata.Month == "2" && Number(postdata.Day) > "29")
        errors += "When the Month is February, the Day cannot exceed 29.<br> <br>";
    if ((postdata.Month == "4" || postdata.Month == "6" || postdata.Month == "9" || postdata.Month == "11") && postdata.Day == "31") {
        errors += "A Day of 31 is invalid for ";
        if (postdata.Month == "4")
            errors += "April";
        if (postdata.Month == "6")
            errors += "June";
        if (postdata.Month == "9")
            errors += "September";
        if (postdata.Month == "11")
            errors += "November";
        errors += ".<br> <br>";
    }

    if (postdata.hasOwnProperty('FamDB'))
        if (postdata.ORIGIN != "ManageRR") {
            if (misc.ProcessDBSysInfo("DBName") == -1)
                errors += "Family DataBase checked, but there is no Family DataBase active. " +
                          "Either un-check Family DataBase or activate a Family DataBase.<br> <br>";
        } else
            if (postdata.FamDB == null)
                errors += "Family DataBase checked, but no Family DataBase has been selected. " +
                          "Either un-check Family DataBase or select a Family DataBase.<br> <br>";

    /* look for data to process */
    if (postdata.ORIGIN == "ManageRR") {
        if (!postdata.hasOwnProperty('FamDB') && !postdata.hasOwnProperty('EuroNA') &&
              !postdata.hasOwnProperty('General') && !postdata.hasOwnProperty('Births') && !postdata.hasOwnProperty('VietWar') &&
              !postdata.hasOwnProperty('Deaths') && !postdata.hasOwnProperty('RevWar') && !postdata.hasOwnProperty('CivilWar') &&
              !postdata.hasOwnProperty('FrIndWar') && !postdata.hasOwnProperty('KorWar') && !postdata.hasOwnProperty('WarOf1812') &&
              !postdata.hasOwnProperty('WWI') && !postdata.hasOwnProperty('WWII') && !postdata.hasOwnProperty('USGeo') &&
              !postdata.hasOwnProperty('WorldGeo') && !postdata.hasOwnProperty('CanadaGeo') && !postdata.hasOwnProperty('MLB')) {
            errors += "No data specified to process. Re-examine and re-submit the form.<br> <br>";
        }
    } else
        if ((!postdata.hasOwnProperty('FamDB') || misc.ProcessDBSysInfo("DBName") == -1) && !postdata.hasOwnProperty('EuroNA') &&
              !postdata.hasOwnProperty('General') && !postdata.hasOwnProperty('Births') && !postdata.hasOwnProperty('VietWar') &&
              !postdata.hasOwnProperty('Deaths') && !postdata.hasOwnProperty('RevWar') && !postdata.hasOwnProperty('CivilWar') &&
              !postdata.hasOwnProperty('FrIndWar') && !postdata.hasOwnProperty('KorWar') && !postdata.hasOwnProperty('WarOf1812') &&
              !postdata.hasOwnProperty('WWI') && !postdata.hasOwnProperty('WWII') && !postdata.hasOwnProperty('USGeo') &&
              !postdata.hasOwnProperty('WorldGeo') && !postdata.hasOwnProperty('CanadaGeo') && !postdata.hasOwnProperty('MLB')) {
            errors += "No data specified to process. Re-examine and re-submit the form.<br> <br>";
        }

    if (postdata.ORIGIN != "ManageRR")
        /* read family data (all body files) for active DataBase */
        if (postdata.hasOwnProperty('FamDB') && misc.ProcessDBSysInfo("DBName") != -1) {
            var rDB = misc.ReadFamilyDB ();
            if (!rDB)
                OTDwarn += "There are no family files for the active DataBase. Family events can not be included in the On This Day Report." +
                            os.EOL + os.EOL;
            if (rDB == -2)
                OTDwarn += "The Family DataBase is larger than 200MB and cannot be processed. " +
                           "Family events can not be included in the On This Day Report." + os.EOL + os.EOL;
        }

    /* include all the user-desired events files which fall outside the family data */
    nonfamdbinfo = "";
    const [resinc, reswarn, resnfi] = processInclusions(JSON.stringify(postdata));
    OTDwarn += reswarn;
    nonfamdbinfo += resnfi;

    if (ind == "RECUR") {
        /* some extra checks */
        if (postdata.hostR == "")
            errors += "The Relay Host is a required entry.<br> <br>";
        if (postdata.loginR == "")
            errors += "The Login is a required entry (for the Relay Host).<br> <br>";
        if (postdata.passwdR == "")
            errors += "The Password is a required entry (for the Relay Host).<br> <br>";
        if (postdata.portR == "")
            errors += "The Port is a required entry (for the Relay Host).<br>If you don't know what the Port is try one of " +
                      "25, 465, 587 or 2525.<br> <br>";
        if (postdata.fromR == "")
            errors += "From is a required entry. (Perhaps use your name or email address.)<br> <br>";
        if (postdata.toR == "")
            errors += "To is a required entry.<br> <br>";
        var to = postdata.toR;
        if (to.indexOf("@") == -1)
            errors += "To needs to be a valid email address.<br> <br>";
        if (errors == '') {
            /* test to make sure email can be sent */
            var transporter = nodemailer.createTransport({
                host: postdata.hostR,
                port: postdata.portR,
                auth: {
                    user: postdata.loginR,
                    pass: postdata.passwdR
                }
            })

            return new Promise((resolve, reject) => {
                transporter.verify((error, info) => {
                    if (error)
                        reject(error);
                    else {
                        resolve(info);
                        setupRecurringOTD(postdata);
                    }
                })
            })
        } else
            return Promise.resolve();
    } else
        if (errors == "")
            DoOnThisDay (postdata);
}

function DoOnThisDay (directives, nfdbi, warni, RECUR, FamDBName) {
    var ddmm, months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    rdata = '';
    /* the css will hide the PRINT button and the system header from a hard copy print */
    if (RECUR != "RECUR") {
        rdata += "<!doctype html> <html> <body id='Body'> <style type='text/css'> @media print { @page { margin-left: 0.5in; ";
        rdata += "margin-right: 0.5in; margin-top: 0; margin-bottom: 0; } #printPB { display: none; } } </style> <pre>";
    }
    rdata += os.EOL + "MELGenKey" + os.EOL + "On This Day Report" + os.EOL + os.EOL;

    /* create date (dd mmm) for matching */
    ddmm = directives.Day;
    if (ddmm.length == 1)
        ddmm = ' ' + ddmm;
    ddmm += " ";

    /* change numeric month to alpha */
    ddmm += months[directives.Month - 1];

    rdata += "For Events occurring on - " + directives.Day + " " + months[directives.Month - 1] + os.EOL + os.EOL;

    rdata += "Data included in On This Day Report:" + os.EOL;
    if (directives.hasOwnProperty('FamDB'))
        if (RECUR == "RECUR")
            rdata += "Family DataBase - " + FamDBName + os.EOL;
        else
            if (misc.ProcessDBSysInfo("DBName") != -1)
                rdata += "Active Family DataBase (" + misc.ProcessDBSysInfo("DBName") + ")" + os.EOL;
    if (RECUR != "RECUR")
        rdata += nonfamdbinfo + os.EOL;
    else
        rdata += nfdbi + os.EOL;

    if ((directives.OBirths || directives.OBaptisms || directives.ODeaths || directives.OMarriages || directives.OBurials ||
                               directives.ODeeds || directives.OResidences || directives.OOccupations || directives.IPeople) &&
                               directives.hasOwnProperty('FamDB')) {
        rdata += "Family events which are omitted:" + os.EOL;
        if (directives.OBirths)
            rdata += "Births" + os.EOL;
        if (directives.OBaptisms)
            rdata += "Baptisms" + os.EOL;
        if (directives.ODeaths)
            rdata += "Deaths" + os.EOL;
        if (directives.OMarriages)
            rdata += "Marriages" + os.EOL;
        if (directives.OBurials)
            rdata += "Burials" + os.EOL;
        if (directives.ODeeds)
            rdata += "Deeds" + os.EOL;
        if (directives.OResidences)
            rdata += "Residences" + os.EOL;
        if (directives.OOccupations)
            rdata += "Occupations" + os.EOL;
        if (directives.IPeople)
            rdata += "Images of People" + os.EOL;
        rdata += os.EOL;
    }

    if (RECUR != "RECUR") {
        if (OTDwarn != "")
            rdata += OTDwarn;
    } else
        if (warni != "")
            rdata += warni;

    cntevt = 0;
    OTDtevnts = [];

    /* add events to report */
    if (directives.hasOwnProperty('FamDB') && misc.ProcessDBSysInfo("DBName") != -1 && RECUR != "RECUR") {
        /* Family events */
        var rDB = misc.ReadFamilyDB ();
        if (!rDB)
            rdata += "There are no family files for the active DataBase. Family events can not be included in the On This Day Report." +
                     os.EOL + os.EOL;
        else
            if (rDB == -2)
                rdata += "The Family DataBase is larger than 200MB and cannot be processed. " +
                         "Family events can not be included in the On This Day Report." + os.EOL + os.EOL;
            else
                misc.OTDEvents (ddmm, directives, familydata, 1);
    }
    if (directives.hasOwnProperty('FamDB') && RECUR == "RECUR") {
        /* load the Family DataBase even if it's not the currently active one */
        var famdata = misc.loadFamDB(FamDBName);
        if (!famdata)
            rdata += "There are no family files for '" + FamDBName + "'. " +
                     "Family events can not be included in the On This Day Report." + os.EOL + os.EOL;
        else
            if (famdata == -2)
                rdata += "'" + FamDBName + "' is larger than 200MB and cannot be processed. " +
                         "Family events can not be included in the On This Day Report." + os.EOL + os.EOL;
            else
                if (famdata == -1)
                    rdata += "'" + FamDBName + "' does not exist. Perhaps it has been 'deported' since this" + os.EOL +
                             "Recurring On This Day Report was created. Family events can not be included in" + os.EOL +
                             "this On This Day Report. The Family DataBase to include may be changed/updated via" + os.EOL +
                             "\"Miscellaneous Functions -> Manage Recurring Reports\"." + os.EOL + os.EOL;
                else
                    misc.OTDEvents (ddmm, directives, famdata, 1);
    }
    if (directives.hasOwnProperty('General') && General != '')
        /* general historical events */
        misc.OTDEvents(ddmm, directives, General, 0);
    if (directives.hasOwnProperty('Births') && Births != '')
        /* births of notable people */
        misc.OTDEvents(ddmm, directives, Births, 0);
    if (directives.hasOwnProperty('Deaths') && Deaths != '')
        /* deaths of notable people */
        misc.OTDEvents(ddmm, directives, Deaths, 0);
    if (directives.hasOwnProperty('FrIndWar') && FrIndWar != '')
        /* French and Indian War */
        misc.OTDEvents(ddmm, directives, FrIndWar, 0);
    if (directives.hasOwnProperty('RevWar') && RevWar != '')
        /* American Revolutionary War */
    if (directives.hasOwnProperty('WarOf1812') && WarOf1812 != '')
        /* War of 1812 */
        misc.OTDEvents(ddmm, directives, WarOf1812, 0);
    if (directives.hasOwnProperty('CivilWar') && CivilWar != '')
        /* American Civil War */
        misc.OTDEvents(ddmm, directives, CivilWar, 0);
    if (directives.hasOwnProperty('WWI') && WWI != '')
        /* World War I */
        misc.OTDEvents(ddmm, directives, WWI, 0);
    if (directives.hasOwnProperty('WWII') && WWII != '')
        /* World War II */
        misc.OTDEvents(ddmm, directives, WWII, 0);
    if (directives.hasOwnProperty('KorWar') && KorWar != '')
        /* Korean War */
        misc.OTDEvents(ddmm, directives, KorWar, 0);
    if (directives.hasOwnProperty('VietWar') && VietWar != '')
        /* Vietnam War */
        misc.OTDEvents(ddmm, directives, VietWar, 0);
    if (directives.hasOwnProperty('EuroNA') && EuroNA != '')
        /* European Colonization of NA */
        misc.OTDEvents(ddmm, directives, EuroNA, 0);
    if (directives.hasOwnProperty('USGeo') && USGeo != '')
        /* USA Geopolitical */
        misc.OTDEvents(ddmm, directives, USGeo, 0);
    if (directives.hasOwnProperty('WorldGeo') && WorldGeo != '')
        /* world Geopolitical */
        misc.OTDEvents(ddmm, directives, WorldGeo, 0);
    if (directives.hasOwnProperty('CanadaGeo') && CanadaGeo != '')
        /* Canada Geopolitical */
        misc.OTDEvents(ddmm, directives, CanadaGeo, 0);
    if (directives.hasOwnProperty('MLB') && MLB != '')
        /* Major League Baseball */
        misc.OTDEvents(ddmm, directives, MLB, 0);

    var swapped;

    /* sort event items by year */
    for (i = 0; i < OTDtevnts.length - 1; i++) {
        swapped = false;

        for (j = 0; j < OTDtevnts.length - 1; j++)
            if (OTDtevnts[j][6] == "-") {
                if (OTDtevnts[j].substring(7,11) < OTDtevnts[j + 1].substring(7,11)) {
                    /* swap them */
                    [OTDtevnts[j], OTDtevnts[j + 1]] = [OTDtevnts[j + 1], OTDtevnts[j]];
                    swapped = true;
                }
            } else
                if (OTDtevnts[j].substring(7,11) > OTDtevnts[j + 1].substring(7,11)) {
                    /* swap them */
                    [OTDtevnts[j], OTDtevnts[j + 1]] = [OTDtevnts[j + 1], OTDtevnts[j]];
                    swapped = true;
                }
        /* if no swap then array is now sorted */
        if (swapped == false)
            break;
    }

    /* Report look - do not show repeat event dates */
    if (directives.hasOwnProperty('DateRepeat') && OTDtevnts.length > 12) {
        var pdate;

        for (i = 1, pdate = OTDtevnts[0].substring(0,11); i < OTDtevnts.length; i++)
            if (OTDtevnts[i].substring(0,11) == pdate)
                OTDtevnts[i] = "           " + OTDtevnts[i].substring(11);
            else
                pdate = OTDtevnts[i].substring(0,11);
    }

    /* Report look - show year only */
    if (directives.hasOwnProperty('YrOnly'))
        for (i = 0; i < OTDtevnts.length; i++)
            OTDtevnts[i] = OTDtevnts[i].substring(7);

    var subCount = 0;
    OTDtevnts.forEach ((el) => {
        if (el == "" || (el.length == 1 && el[0] == "\n"))
            subCount++;
    })
    rdata += "Number of Events - " + (OTDtevnts.length - subCount) + os.EOL + os.EOL;
    rdata += os.EOL + "Start of Events" + os.EOL + os.EOL;

    OTDtevnts.forEach ((el) => {
        if (el.length > 4)
            rdata += el;
    })

    rdata += os.EOL + "End of Report" + os.EOL;

    if (RECUR == "RECUR")
        return rdata;
    rdata += "</pre> <script type=\"text/javascript\" src=\"clib.js\"></script> <button id='printPB' " +
             "onclick='userPrint(\"OnThisDay\")'>Print Report</button> </body> </html>";
}

function setupRecurringOTD(postdata) {
    var OTDR2Add = {
                     "name": null,
                     "active": null,                    // 0 if inactive; 1 if active
                     "hour": postdata.timeHR,
                     "minute": postdata.timeMR,
                     "host": postdata.hostR,
                     "port": postdata.portR,
                     "login": postdata.loginR,
                     "passwd": postdata.passwdR,
                     "from": postdata.fromR,
                     "to": postdata.toR,
                     "subject": postdata.subjectR,
                     "include": [],
                     "look": [],
                     "omits": [],
                     "FamDBName": null
    };
    if (postdata.hasOwnProperty('Active'))
        OTDR2Add.active = postdata.Active;
    else
        OTDR2Add.active = 1;
    if (!Object.keys(OTDRecur).length)
        OTDR2Add.name = "OTD0";
    else
        OTDR2Add.name = "OTD" + (Number(OTDRecur[Object.keys(OTDRecur).length - 1].name.substring(3)) + 1).toString();
    OTDR2Add.include.length = 0;
    OTDR2Add.look.length = 0;
    OTDR2Add.omits.length = 0;
    if (postdata.hasOwnProperty('DateRepeat'))
        OTDR2Add.look.push('DateRepeat');
    if (postdata.hasOwnProperty('YrOnly'))
        OTDR2Add.look.push('YrOnly');

    if (postdata.hasOwnProperty('FamDB')) {
        OTDR2Add.include.push('FamDB');
        OTDR2Add.FamDBName = misc.ProcessDBSysInfo("DBName");
    }
    if (postdata.hasOwnProperty('EuroNA'))
        OTDR2Add.include.push('EuroNA');
    if (postdata.hasOwnProperty('General'))
        OTDR2Add.include.push('General');
    if (postdata.hasOwnProperty('Births'))
        OTDR2Add.include.push('Births');
    if (postdata.hasOwnProperty('VietWar'))
        OTDR2Add.include.push('VietWar');
    if (postdata.hasOwnProperty('Deaths'))
        OTDR2Add.include.push('Deaths');
    if (postdata.hasOwnProperty('RevWar'))
        OTDR2Add.include.push('RevWar');
    if (postdata.hasOwnProperty('CivilWar'))
        OTDR2Add.include.push('CivilWar');
    if (postdata.hasOwnProperty('FrIndWar'))
        OTDR2Add.include.push('FrIndWar');
    if (postdata.hasOwnProperty('KorWar'))
        OTDR2Add.include.push('KorWar');
    if (postdata.hasOwnProperty('WarOf1812'))
        OTDR2Add.include.push('WarOf1812');
    if (postdata.hasOwnProperty('WWI'))
        OTDR2Add.include.push('WWI');
    if (postdata.hasOwnProperty('WWII'))
        OTDR2Add.include.push('WWII');
    if (postdata.hasOwnProperty('USGeo'))
        OTDR2Add.include.push('USGeo');
    if (postdata.hasOwnProperty('WorldGeo'))
        OTDR2Add.include.push('WorldGeo');
    if (postdata.hasOwnProperty('CanadaGeo'))
        OTDR2Add.include.push('CanadaGeo');
    if (postdata.hasOwnProperty('MLB'))
        OTDR2Add.include.push('MLB');

    if (postdata.hasOwnProperty('OBirths'))
        OTDR2Add.omits.push('OBirths');
    if (postdata.hasOwnProperty('OBaptisms'))
        OTDR2Add.omits.push('OBaptisms');
    if (postdata.hasOwnProperty('ODeaths'))
        OTDR2Add.omits.push('ODeaths');
    if (postdata.hasOwnProperty('OMarriages'))
        OTDR2Add.omits.push('OMarriages');
    if (postdata.hasOwnProperty('OBurials'))
        OTDR2Add.omits.push('OBurials');
    if (postdata.hasOwnProperty('ODeeds'))
        OTDR2Add.omits.push('ODeeds');
    if (postdata.hasOwnProperty('OResidences'))
        OTDR2Add.omits.push('OResidences');
    if (postdata.hasOwnProperty('OOccupations'))
        OTDR2Add.omits.push('OOccupations');
    if (postdata.hasOwnProperty('IPeople'))
        OTDR2Add.omits.push('IPeople');

    if (postdata.ORIGIN != "ManageRR") {
        OTDRecur.push(OTDR2Add);
        misc.dirExist("UserFiles");
        try {
            fs.writeFileSync(path.join("UserFiles", "OTDRecur.json"), JSON.stringify(OTDRecur, null, 2));
            misc.Logging("Saved Recurring On This Day Report parameter file.");
        }
        catch (err) {
            misc.Logging(err + ", could not save Recurring On This Day Report parameter file.");
        }
    }
}

function processInclusions(inc) {
    var resinc = '', reswarn = '', resnfi = '';

    if (inc.indexOf("General") != -1) {
        resinc += '"General":"General"';
        if (General == "") {
            if (!fs.existsSync("./Include/Timelines/GeneralTimeline.txt"))
                reswarn += "The General Events file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            else {
                try {
                    General = fs.readFileSync("./Include/Timelines/GeneralTimeline.txt", 'utf8');
                    General = General.replace(/\r\n/g, '\n');
                    resnfi += "General Events" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/GeneralTimeline.txt'.");
                    reswarn += "Problem reading General Events file and cannot include it in the On This Day Report." + os.EOL + os.EOL;
                }
            }
        } else
            resnfi += "General Events" + os.EOL;
    }

    if (inc.indexOf("Births") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"Births":"Births"';
        if (Births == "") {
            if (!fs.existsSync("./Include/Timelines/Births.txt")) {
                reswarn += "The Births of Notable People file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    Births = fs.readFileSync("./Include/Timelines/Births.txt", 'utf8');
                    Births = Births.replace(/\r\n/g, '\n');
                    resnfi += "Births of Notable People" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/Births.txt'.");
                    reswarn += "Problem reading Births file and cannot include it in the On This Day Report." + os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "Births of Notable People" + os.EOL;
        }
    }

    if (inc.indexOf("Deaths") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"Deaths":"Deaths"';
        if (Births == "") {
            if (!fs.existsSync("./Include/Timelines/Deaths.txt")) {
                reswarn += "The Deaths of Notable People file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    Deaths = fs.readFileSync("./Include/Timelines/Deaths.txt", 'utf8');
                    Deaths = Deaths.replace(/\r\n/g, '\n');
                    resnfi += "Deaths of Notable People" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/Deaths.txt'.");
                    reswarn += "Problem reading Deaths file and cannot include it in the On This Day Report." + os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "Deaths of Notable People" + os.EOL;
        }
    }

    if (inc.indexOf("FrIndWar") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"FrIndWar":"FrIndWar"';
        if (FrIndWar == "") {
            if (!fs.existsSync("./Include/Timelines/FrenchAndIndianWarTimeline.txt")) {
                reswarn += "The French & Indian War file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    FrIndWar = fs.readFileSync("./Include/Timelines/FrenchAndIndianWarTimeline.txt", 'utf8');
                    FrIndWar = FrIndWar.replace(/\r\n/g, '\n');
                    resnfi += "French & Indian War" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/FrenchAndIndianWarTimeline.txt'.");
                    reswarn += "Problem reading French & Indian War file and cannot include it in the On This Day Report." + os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "French & Indian War" + os.EOL;
        }
    }

    if (inc.indexOf("EuroNA") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"EuroNA":"EuroNA"';
        if (EuroNA == "") {
            if (!fs.existsSync("./Include/Timelines/EuropeanColonizationOfNA.txt")) {
                reswarn += "The European Colonization file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    EuroNA = fs.readFileSync("./Include/Timelines/EuropeanColonizationOfNA.txt", 'utf8');
                    EuroNA = EuroNA.replace(/\r\n/g, '\n');
                    resnfi += "European Colonization of North America" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/EuropeanColonizationOfNA.txt'.");
                    reswarn += "Problem reading the European Colonization file and cannot include it in the On This Day Report." + os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "European Colonization of North America" + os.EOL;
        }
    }

    if (inc.indexOf("VietWar") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"VietWar":"VietWar"';
        if (VietWar == "") {
            if (!fs.existsSync("./Include/Timelines/VietnamWarTimeline.txt")) {
                reswarn += "The Vietnam War Timeline file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    VietWar = fs.readFileSync("./Include/Timelines/VietnamWarTimeline.txt", 'utf8');
                    VietWar = VietWar.replace(/\r\n/g, '\n');
                    resnfi += "Vietnam War" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/VietnamWarTimeline.txt'.");
                    reswarn += "Problem reading the Vietnam War Timeline file and cannot include it in the On This Day Report." + os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "Vietnam War" + os.EOL;
        }
    }

    if (inc.indexOf("KorWar") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"KorWar":"KorWar"';
        if (KorWar == "") {
            if (!fs.existsSync("./Include/Timelines/KoreanWarTimeline.txt")) {
                reswarn += "The Korean War Timeline file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    KorWar = fs.readFileSync("./Include/Timelines/KoreanWarTimeline.txt", 'utf8');
                    KorWar = KorWar.replace(/\r\n/g, '\n');
                    resnfi += "Korean War" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/KoreanWarTimeline.txt'.");
                    reswarn += "Problem reading the Korean War Timeline file and cannot include it in the On This Day Report." + os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "Korean War" + os.EOL;
        }
    }

    if (inc.indexOf("RevWar") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"RevWar":"RevWar"';
        if (RevWar == "") {
            if (!fs.existsSync("./Include/Timelines/AmericanRevolutionTimeline.txt")) {
                reswarn += "The American Revolutionary War Timeline file does not exist and cannot be included in the On This Day Report." +
                            os.EOL + os.EOL;
            }
            else {
                try {
                    RevWar = fs.readFileSync("./Include/Timelines/AmericanRevolutionTimeline.txt", 'utf8');
                    RevWar = RevWar.replace(/\r\n/g, '\n');
                    resnfi += "American Revolutionary War" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/AmericanRevolutionTimeline.txt'.");
                    reswarn += "Problem reading the American Revolutionary War Timeline file and cannot include it in the On This Day Report." +
                                os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "American Revolutionary War" + os.EOL;
        }
    }

    if (inc.indexOf("CivilWar") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"CivilWar":"CivilWar"';
        if (CivilWar == "") {
            if (!fs.existsSync("./Include/Timelines/AmericanCivilWarTimeline.txt")) {
                reswarn += "The American Civil War Timeline file does not exist and cannot be included in the On This Day Report." +
                            os.EOL + os.EOL;
            }
            else {
                try {
                    CivilWar = fs.readFileSync("./Include/Timelines/AmericanCivilWarTimeline.txt", 'utf8');
                    CivilWar = CivilWar.replace(/\r\n/g, '\n');
                    resnfi += "American Civil War" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/AmericanCivilWarTimeline.txt'.");
                    reswarn += "Problem reading the American Civil War Timeline file and cannot include it in the On This Day Report." +
                                os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "American Civil War" + os.EOL;
        }
    }

    if (inc.indexOf("WarOf1812") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"WarOf1812":"WarOf1812"';
        if (WarOf1812 == "") {
            if (!fs.existsSync("./Include/Timelines/WarOf1812Timeline.txt")) {
                reswarn += "The War of 1812 Timeline file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    WarOf1812 = fs.readFileSync("./Include/Timelines/WarOf1812Timeline.txt", 'utf8');
                    WarOf1812 = WarOf1812.replace(/\r\n/g, '\n');
                    resnfi += "War of 1812" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/WarOf1812Timeline.txt'.");
                    reswarn += "Problem reading the War of 1812 Timeline file and cannot include it in the On This Day Report." + os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "War of 1812" + os.EOL;
        }
    }

    if (inc.indexOf("WWI") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"WWI":"WWI"';
        if (WWI == "") {
            if (!fs.existsSync("./Include/Timelines/WWITimeline.txt")) {
                reswarn += "The World War I Timeline file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    WWI = fs.readFileSync("./Include/Timelines/WWITimeline.txt", 'utf8');
                    WWI = WWI.replace(/\r\n/g, '\n');
                    resnfi += "World War I" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/WWITimeline.txt'.");
                    reswarn += "Problem reading the World War I Timeline file and cannot include it in the On This Day Report." + os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "World War I" + os.EOL;
        }
    }

    if (inc.indexOf("WWII") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"WWII":"WWII"';
        if (WWII == "") {
            if (!fs.existsSync("./Include/Timelines/WWIITimeline.txt")) {
                reswarn += "The World War II Timeline file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    WWII = fs.readFileSync("./Include/Timelines/WWIITimeline.txt", 'utf8');
                    WWII = WWII.replace(/\r\n/g, '\n');
                    resnfi += "World War II" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/WWIITimeline.txt'.");
                    reswarn += "Problem reading the World War II Timeline file and cannot include it in the On This Day Report." + os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "World War II" + os.EOL;
        }
    }

    if (inc.indexOf("USGeo") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"USGeo":"USGeo"';
        if (USGeo == "") {
            if (!fs.existsSync("./Include/Timelines/USAGeopoliticalTimeline.txt")) {
                reswarn += "The USA Geopolitical Timeline file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    USGeo = fs.readFileSync("./Include/Timelines/USAGeopoliticalTimeline.txt", 'utf8');
                    USGeo = USGeo.replace(/\r\n/g, '\n');
                    resnfi += "USA Geopolitical" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/USAGeopoliticalTimeline.txt'.");
                    reswarn += "Problem reading the USA Geopolitical Timeline file and cannot include it in the On This Day Report." +
                                os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "USA Geopolitical" + os.EOL;
        }
    }

    if (inc.indexOf("WorldGeo") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"WorldGeo":"WorldGeo"';
        if (WorldGeo == "") {
            if (!fs.existsSync("./Include/Timelines/WorldGeopoliticalTimeline.txt")) {
                reswarn += "The World Geopolitical Timeline file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    WorldGeo = fs.readFileSync("./Include/Timelines/WorldGeopoliticalTimeline.txt", 'utf8');
                    WorldGeo = WorldGeo.replace(/\r\n/g, '\n');
                    resnfi += "World Geopolitical" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/WorldGeopoliticalTimeline.txt'.");
                    reswarn += "Problem reading the World Geopolitical Timeline file and cannot include it in the On This Day Report." +
                                os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "World Geopolitical" + os.EOL;
        }
    }

    if (inc.indexOf("CanadaGeo") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"CanadaGeo":"CanadaGeo"';
        if (CanadaGeo == "") {
            if (!fs.existsSync("./Include/Timelines/CanadaGeopoliticalTimeline.txt")) {
                reswarn += "The Canada Geopolitical Timeline file does not exist and cannot be included in the On This Day Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    CanadaGeo = fs.readFileSync("./Include/Timelines/CanadaGeopoliticalTimeline.txt", 'utf8');
                    CanadaGeo = CanadaGeo.replace(/\r\n/g, '\n');
                    resnfi += "Canada Geopolitical" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/CanadaGeopoliticalTimeline.txt'.");
                    reswarn += "Problem reading the Canada Geopolitical Timeline file and cannot include it in the On This Day Report." +
                                os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "Canada Geopolitical" + os.EOL;
        }
    }

    if (inc.indexOf("MLB") != -1) {
        if (resinc != '')
            resinc += ',';
        resinc += '"MLB":"MLB"';
        if (MLB == "") {
            if (!fs.existsSync("./Include/Timelines/MLBTimeline.txt")) {
                reswarn += "The Major League Baseball Timeline file does not exist and cannot be included in the On This Day Report." +
                            os.EOL + os.EOL;
            }
            else {
                try {
                    MLB = fs.readFileSync("./Include/Timelines/MLBTimeline.txt", 'utf8');
                    MLB = MLB.replace(/\r\n/g, '\n');
                    resnfi += "Major League Baseball" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading './Include/Timelines/MLBTimeline.txt'.");
                    reswarn += "Problem reading the Major League Baseball Timeline file and cannot include it in the On This Day Report." +
                                os.EOL + os.EOL;
                }
            }
        }
        else {
            resnfi += "Major League Baseball" + os.EOL;
        }
    }

    return [resinc, reswarn, resnfi];
}

module.exports = { OnThisDay, DoOnThisDay, processInclusions };

