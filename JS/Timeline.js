const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const misc = require ("./misc.js");

var nonfamdbinfo, indname, famname, childnum, TLwarnings = '';

async function Timeline (postdata) {
    /* user wants to create a Timeline */

    var bodyposInd = 0, bodyposFam = 0, TLerrors = '';

    /* remove any leading and following whitespace */
    var psT = JSON.stringify(postdata);
    if (psT.indexOf("IndID") != -1)
        postdata.IndID = postdata.IndID.trim();
    if (psT.indexOf("FamID") != -1)
        postdata.FamID = postdata.FamID.trim();

    /* check dates */
    if (postdata.SDate == "" || postdata.EDate == "")
        TLerrors += "Both Start Date and End Date are required.<br> <br>";
    /* end date must be equal to or later than start date */
    if (postdata.SADBC == "SAD" && postdata.EADBC == "EAD")
        if (postdata.EDate != "" && postdata.SDate != "" && postdata.EDate < postdata.SDate)
            TLerrors += "The End Date is earlier than the Start Date.<br> <br>";
    if (postdata.SADBC == "SAD" && postdata.EADBC == "EBC")
        TLerrors += "The End Date is earlier than the Start Date. (Start Date is AD & End Date is BC.)<br> <br>";
    if (postdata.SADBC == "SBC" && postdata.EADBC == "EBC")
        if (postdata.EDate != "" && postdata.SDate != "" && (Number(postdata.EDate.substring(0,4)) > Number(postdata.SDate.substring(0,4)) ||
                         (Number(postdata.EDate.substring(0,4)) == Number(postdata.SDate.substring(0,4)) && postdata.EDate < postdata.SDate)))
            TLerrors += "The End Date is earlier than the Start Date.<br> <br>";

    /* look for data to process */
    if (postdata.IndID == "" && postdata.FamID == "" &&
          !postdata.hasOwnProperty('General') && !postdata.hasOwnProperty('Births') &&
          !postdata.hasOwnProperty('FrIndWar') && !postdata.hasOwnProperty('WarOf1812') &&
          !postdata.hasOwnProperty('Deaths') && !postdata.hasOwnProperty('RevWar') && !postdata.hasOwnProperty('CivilWar') &&
          !postdata.hasOwnProperty('WWI') && !postdata.hasOwnProperty('WWII') && !postdata.hasOwnProperty('USGeo') &&
          !postdata.hasOwnProperty('KorWar') && !postdata.hasOwnProperty('VietWar') && !postdata.hasOwnProperty('EuroNA') &&
          !postdata.hasOwnProperty('WorldGeo') && !postdata.hasOwnProperty('CanadaGeo') && !postdata.hasOwnProperty('MLB')) {
        TLerrors += "No data specified to process.  Re-examine and re-submit the form.<br> <br>";
    }

    /* if, needed, read family data (all body files) for active DataBase if it hasn't already been read */
    if ((psT.indexOf("IndID") != -1 && postdata.IndID != "") || (psT.indexOf("FamID") != -1 && postdata.FamID != "")) {
        var rDB = misc.ReadFamilyDB ();
        if (!rDB)
            TLwarnings += "There are no family files for the active DataBase. Family events can not be included in the Timeline.<br> <br>";
        if (rDB == -2)
            TLwarnings += "The DataBase is larger than 200MB and cannot be processed. Family events can not be included in the Timeline.<br> <br>";

        if (psT.indexOf("IndID") != -1 && postdata.IndID != "")
            bodyposInd = validateID (postdata.IndID, postdata.ChildID);
        if (psT.indexOf("FamID") != -1 && postdata.FamID != "")
            bodyposFam = validateID (postdata.FamID, -1);

        if (bodyposInd == -1) {
            TLerrors += "Individual ID (" + postdata.IndID + ") invalid. First character and last character must be numeric, ";
            TLerrors += "all other characters must be numeric or '.', and there must be one and only one '.' in an ID.<br> <br>";
        }
        if (bodyposFam == -1) {
            TLerrors += "Family ID (" + postdata.FamID + ") invalid. First character and last character must be numeric, ";
            TLerrors += "all other characters must be numeric or '.', and there must be at least one '.' in an ID.<br> <br>";
        }
        if (bodyposInd == -2)
            TLerrors += "Individual ID (" + postdata.IndID + ") does not exist in the family data.<br> <br>";
        if (bodyposFam == -2)
            TLerrors += "Family ID (" + postdata.FamID + ") does not exist in the family data.<br> <br>";
        if (bodyposInd == -3)
            TLerrors += "Child ID (" + postdata.ChildID + ") invalid.  Child ID must be a valid Roman Numeral number.<br> <br>";
        if (bodyposInd == -4)
            TLerrors += "Child ID (" + postdata.ChildID + ") for Individual ID (" + postdata.IndID + ") does not exist.<br> <br>";
        if (bodyposInd == -5) {
            TLerrors += "Child ID (" + postdata.ChildID + ") for Individual ID (" + postdata.IndID + ") exists, but has it's own ID. ";
            TLerrors += "That means this child is the head of it's own family. Use this ID and re-submit the form.<br> <br>";
        }
    }

    /* include all the user-desired events files which fall outside the family data */
    nonfamdbinfo = "";
    if (postdata.General == "General") {
        if (General == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/GeneralTimeline.txt")))
                TLwarnings += "The General Events file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            else {
                try {
                    General = fs.readFileSync(path.normalize("./Include/Timelines/GeneralTimeline.txt"), 'utf8');
                    General = General.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "General Events" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/GeneralTimeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "General Events" + os.EOL;
        }
    }
    if (postdata.Births == "Births") {
        if (Births == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/Births.txt"))) {
                TLwarnings += "The Births of Notable People file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    Births = fs.readFileSync(path.normalize("./Include/Timelines/Births.txt"), 'utf8');
                    Births = Births.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "Births of Notable People" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/Births.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "Births of Notable People" + os.EOL;
        }
    }
    if (postdata.Deaths == "Deaths") {
        if (Deaths == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/Deaths.txt"))) {
                TLwarnings += "The Deaths of Notable People file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    Deaths = fs.readFileSync(path.normalize("./Include/Timelines/Deaths.txt"), 'utf8');
                    Deaths = Deaths.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "Deaths of Notable People" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/Deaths.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "Deaths of Notable People" + os.EOL;
        }
    }
    if (postdata.FrIndWar == "FrIndWar") {
        if (FrIndWar == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/FrenchAndIndianWarTimeline.txt"))) {
                TLwarnings += "The French and Indian War file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    FrIndWar = fs.readFileSync(path.normalize("./Include/Timelines/FrenchAndIndianWarTimeline.txt"), 'utf8');
                    FrIndWar = FrIndWar.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "French and Indian War" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/FrenchAndIndianWarTimeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "French and Indian War" + os.EOL;
        }
    }
    if (postdata.RevWar == "RevWar") {
        if (RevWar == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/AmericanRevolutionTimeline.txt"))) {
                TLwarnings += "The American Revolutionary War file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    RevWar = fs.readFileSync(path.normalize("./Include/Timelines/AmericanRevolutionTimeline.txt"), 'utf8');
                    RevWar = RevWar.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "American Revolutionary War" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/AmericanRevolutionTimeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "American Revolutionary War" + os.EOL;
        }
    }
    if (postdata.WarOf1812 == "WarOf1812") {
        if (WarOf1812 == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/WarOf1812Timeline.txt"))) {
                TLwarnings += "The War of 1812 file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    WarOf1812 = fs.readFileSync(path.normalize("./Include/Timelines/WarOf1812Timeline.txt"), 'utf8');
                    WarOf1812 = WarOf1812.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "War of 1812" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/WarOf1812Timeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "War of 1812" + os.EOL;
        }
    }
    if (postdata.CivilWar == "CivilWar") {
        if (CivilWar == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/AmericanCivilWarTimeline.txt"))) {
                TLwarnings += "The American Civil War file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    CivilWar = fs.readFileSync(path.normalize("./Include/Timelines/AmericanCivilWarTimeline.txt"), 'utf8');
                    CivilWar = CivilWar.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "American Civil War" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/AmericanCivilWarTimeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "American Civil War" + os.EOL;
        }
    }
    if (postdata.WWI == "WWI") {
        if (WWI == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/WWITimeline.txt"))) {
                TLwarnings += "The World War I file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    WWI = fs.readFileSync(path.normalize("./Include/Timelines/WWITimeline.txt"), 'utf8');
                    WWI = WWI.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "World War I" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/WWITimeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "World War I" + os.EOL;
        }
    }
    if (postdata.WWII == "WWII") {
        if (WWII == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/WWIITimeline.txt"))) {
                TLwarnings += "The World War II file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    WWII = fs.readFileSync(path.normalize("./Include/Timelines/WWIITimeline.txt"), 'utf8');
                    WWII = WWII.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "World War II" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/WWIITimeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "World War II" + os.EOL;
        }
    }
    if (postdata.KorWar == "KorWar") {
        if (KorWar == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/KoreanWarTimeline.txt"))) {
                TLwarnings += "The Korean War file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    KorWar = fs.readFileSync(path.normalize("./Include/Timelines/KoreanWarTimeline.txt"), 'utf8');
                    KorWar = KorWar.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "Korean War" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/KoreanWarTimeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "Korean War" + os.EOL;
        }
    }
    if (postdata.VietWar == "VietWar") {
        if (VietWar == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/VietnamWarTimeline.txt"))) {
                TLwarnings += "The Vietnam War file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    VietWar = fs.readFileSync(path.normalize("./Include/Timelines/VietnamWarTimeline.txt"), 'utf8');
                    VietWar = VietWar.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "Vietnam War" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/VietnamWarTimeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "Vietnam War" + os.EOL;
        }
    }
    if (postdata.EuroNA == "EuroNA") {
        if (EuroNA == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/EuropeanColonizationOfNA.txt"))) {
                TLwarnings += "The European Colonization of North America file does not exist and cannot be included in the Timeline Report." +
                            os.EOL + os.EOL;
            }
            else {
                try {
                    EuroNA = fs.readFileSync(path.normalize("./Include/Timelines/EuropeanColonizationOfNA.txt"), 'utf8');
                    EuroNA = EuroNA.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "European Colonization of North America" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/EuropeanColonizationOfNA.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "European Colonization of North America" + os.EOL;
        }
    }
    if (postdata.USGeo == "USGeo") {
        if (USGeo == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/USAGeopoliticalTimeline.txt"))) {
                TLwarnings += "The United States Geopolitical file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    USGeo = fs.readFileSync(path.normalize("./Include/Timelines/USAGeopoliticalTimeline.txt"), 'utf8');
                    USGeo = USGeo.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "United States Geopolitical" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/USAGeopoliticalTimeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "United States Geopolitical" + os.EOL;
        }
    }
    if (postdata.WorldGeo == "WorldGeo") {
        if (WorldGeo == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/WorldGeopoliticalTimeline.txt"))) {
                TLwarnings += "The World Geopolitical file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    WorldGeo = fs.readFileSync(path.normalize("./Include/Timelines/WorldGeopoliticalTimeline.txt"), 'utf8');
                    WorldGeo = WorldGeo.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "World Geopolitical" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/WorldGeopoliticalTimeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "World Geopolitical" + os.EOL;
        }
    }
    if (postdata.CanadaGeo == "CanadaGeo") {
        if (CanadaGeo == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/CanadaGeopoliticalTimeline.txt"))) {
                TLwarnings += "The Canada Geopolitical file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    CanadaGeo = fs.readFileSync(path.normalize("./Include/Timelines/CanadaGeopoliticalTimeline.txt"), 'utf8');
                    CanadaGeo = General.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "Canada Geopolitical" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/CanadaGeopoliticalTimeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "Canada Geopolitical" + os.EOL;
        }
    }
    if (postdata.MLB == "MLB") {
        if (MLB == "") {
            if (!fs.existsSync(path.normalize("./Include/Timelines/MLBTimeline.txt"))) {
                TLwarnings += "The Major League Baseball file does not exist and cannot be included in the Timeline Report." + os.EOL + os.EOL;
            }
            else {
                try {
                    MLB = fs.readFileSync(path.normalize("./Include/Timelines/MLBTimeline.txt"), 'utf8');
                    MLB = MLB.replace(/\r\n/g, '\n');
                    nonfamdbinfo += "Major League Baseball" + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem reading " + path.normalize('./Include/Timelines/MLBTimeline.txt') + ".");
                }
            }
        }
        else {
            nonfamdbinfo += "Major League Baseball" + os.EOL;
        }
    }

    if (TLerrors == "") {
        const TLReport = await DoTimeline (postdata, bodyposInd, bodyposFam);
        return TLReport;
    } else {
        TLerrors = "ERRORS " + TLerrors;
        return TLerrors;
    }
}

async function DoTimeline (directives, indpos, fampos) {
    var psT = JSON.stringify(directives), TLRep = '';
    /* the css will hide the PRINT button and the system header from a hard copy print */
    TLRep += "<!doctype html> <html> <body id='Body'> <style type='text/css'> @media print { @page { margin-left: 0.5in; margin-right: 0.5in; ";
    TLRep += " margin-top: 0; margin-bottom: 0; } #printPB { display: none; } } </style> <pre>";
    TLRep += os.EOL + "Timeline Report" + os.EOL + os.EOL;

    var sdate = new Date(directives.SDate);
    sdate.setHours(0,0,0,0);         /* want only month, day & year */
    sdate.setDate(sdate.getDate());
    sdate.setDate(sdate.getDate() + 1);   /* new Date() is subtracting 1 from the date for whatever reason */
    var formattedDate = sdate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    formattedDate = formattedDate.replace(/^0+/, '');    /* remove leading zero from day if there is one */
    formattedDate = formattedDate.replace("Sept", "Sep");    /* short September is Sept to JS */
    if (directives.SADBC == "SAD")
        var tt = " AD";
    else
        var tt = " BC";
    TLRep += "Start Date - " + formattedDate + tt + os.EOL; 
    var edate = new Date(directives.EDate);
    edate.setHours(0,0,0,0);         /* want only month, day & year */
    edate.setDate(edate.getDate()+1);   /* new Date() is subtracting 1 from the date */
                                        /* it's because of the difference in time zones; see DateAgeCalc.html */
    formattedDate = edate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    formattedDate = formattedDate.replace(/^0+/, '');    /* remove leading zero from day if there is one */
    formattedDate = formattedDate.replace("Sept", "Sep");    /* short September is Sept to JS */
    if (directives.EADBC == "EAD")
        var tt = " AD";
    else
        var tt = " BC";
    TLRep += "End Date - " + formattedDate + tt + os.EOL; 

    if ((directives.IndID != "" && psT.indexOf("IndID") != -1) || (directives.FamID != "" && psT.indexOf("FamID") != -1))
        TLRep += os.EOL + "Family DataBase - " + misc.ProcessDBSysInfo("DBName") + os.EOL; 

    if (directives.IndID != "" && psT.indexOf("IndID") != -1) {
        TLRep += os.EOL + "Events for Individual - "; 
        TLRep += familydata.substring(indpos, familydata.indexOf("\n", indpos)); 
        if (directives.ChildID != "" && psT.indexOf("ChildID") != -1)
            TLRep += (", child " + directives.ChildID);
    }
    TLRep += os.EOL;

    if (directives.FamID != "" && psT.indexOf("FamID") != -1) {
        if (directives.IndID != "" && psT.indexOf("IndID") != -1) {
            TLRep += "and" + os.EOL; 
            TLRep += "for Family of - "; 
        }
        else
            TLRep += "Events for Family of - "; 
        TLRep += familydata.substring(fampos, familydata.indexOf("\n", fampos));
        TLRep += os.EOL + os.EOL;
    } else {
        if (directives.IndID != "" && psT.indexOf("IndID") != -1)
            TLRep += os.EOL;
        else
            TLRep += "Family-related Events not included." + os.EOL + os.EOL;
    }

    if (directives.OBirths || directives.OBaptisms || directives.ODeaths || directives.OMarriages || directives.OBurials ||
                               directives.ODeeds || directives.OResidences || directives.OOccupations || directives.IPeople) {
        TLRep += "Family events which are omitted:" + os.EOL;
        if (directives.OBirths)
            TLRep += "Births" + os.EOL;
        if (directives.OBaptisms)
            TLRep += "Baptisms" + os.EOL;
        if (directives.ODeaths)
            TLRep += "Deaths" + os.EOL;
        if (directives.OMarriages)
            TLRep += "Marriages" + os.EOL;
        if (directives.OBurials)
            TLRep += "Burials" + os.EOL;
        if (directives.ODeeds)
            TLRep += "Deeds" + os.EOL;
        if (directives.OResidences)
            TLRep += "Residences" + os.EOL;
        if (directives.OOccupations)
            TLRep += "Occupations" + os.EOL;
        if (directives.IPeople)
            TLRep += "Images of People" + os.EOL;
        TLRep += os.EOL;
    }

    if (nonfamdbinfo != "") {
        TLRep += "Non-family event files included in Timeline Report:" + os.EOL;
        TLRep += nonfamdbinfo;
        TLRep += os.EOL;
    }

    if ((directives.EuroNA || directives.USGeo || directives.WorldGeo || directives.CanadaGeo) && directives.GeoSel) {
        TLRep += "Non-Family Events only for those geographical areas associated with the selected individuals and/or family will be included.";
        TLRep += os.EOL + os.EOL;
    }

    if (TLwarnings != "")
        TLRep += TLwarnings;

    TLRep += os.EOL + "Note - Because of the switch from the Julian calendar to the Gregorian calendar, some dates (especially " +
                      "those before 14 Sep 1752) may or may not be 10-12 days off." + os.EOL + os.EOL;
    TLRep += os.EOL + "Start of Events" + os.EOL + os.EOL;
    tdata = "";

    /* add events to report */
    if (directives.IndID != "" && familydata != '')
        /* individual or child of individual */
        misc.TimelineEvents(indpos, sdate, edate, directives, indname, familydata, 1);
    if (directives.FamID != "" && familydata != '')
        /* family */
        misc.TimelineEvents(fampos, sdate, edate, directives, 0, familydata, 2);
    if (directives.hasOwnProperty('General') && General != '')
        /* general historical events */
        misc.TimelineEvents(0, sdate, edate, directives, 0, General, 0);
    if (directives.hasOwnProperty('Births') && Births != '')
        /* births of notable people */
        misc.TimelineEvents(0, sdate, edate, directives, 0, Births, 0);
    if (directives.hasOwnProperty('Deaths') && Deaths != '')
        /* deaths of notable people */
        misc.TimelineEvents(0, sdate, edate, directives, 0, Deaths, 0);
    if (directives.hasOwnProperty('FrIndWar') && FrIndWar != '')
        /* French and Indian War */
        misc.TimelineEvents(0, sdate, edate, directives, 0, FrIndWar, 0);
    if (directives.hasOwnProperty('RevWar') && RevWar != '')
        /* American Revolutionary War */
        misc.TimelineEvents(0, sdate, edate, directives, 0, RevWar, 0);
    if (directives.hasOwnProperty('WarOf1812') && WarOf1812 != '')
        /* War of 1812 */
        misc.TimelineEvents(0, sdate, edate, directives, 0, WarOf1812, 0);
    if (directives.hasOwnProperty('CivilWar') && CivilWar != '')
        /* American Civil War */
        misc.TimelineEvents(0, sdate, edate, directives, 0, CivilWar, 0);
    if (directives.hasOwnProperty('WWI') && WWI != '')
        /* World War I */
        misc.TimelineEvents(0, sdate, edate, directives, 0, WWI, 0);
    if (directives.hasOwnProperty('WWII') && WWII != '')
        /* World War II */
        misc.TimelineEvents(0, sdate, edate, directives, 0, WWII, 0);
    if (directives.hasOwnProperty('KorWar') && KorWar != '')
        /* Korean War */
        misc.TimelineEvents(0, sdate, edate, directives, 0, KorWar, 0);
    if (directives.hasOwnProperty('VietWar') && VietWar != '')
        /* Vietnam War */
        misc.TimelineEvents(0, sdate, edate, directives, 0, VietWar, 0);
    if (directives.hasOwnProperty('EuroNA') && EuroNA != '')
        /* European colonization of US */
        misc.TimelineEvents(0, sdate, edate, directives, 0, EuroNA, 0);
    if (directives.hasOwnProperty('USGeo') && USGeo != '')
        /* USA Geopolitical */
        misc.TimelineEvents(0, sdate, edate, directives, 0, USGeo, 0);
    if (directives.hasOwnProperty('WorldGeo') && WorldGeo != '')
        /* world Geopolitical */
        misc.TimelineEvents(0, sdate, edate, directives, 0, WorldGeo, 0);
    if (directives.hasOwnProperty('CanadaGeo') && CanadaGeo != '')
        /* Canada Geopolitical */
        misc.TimelineEvents(0, sdate, edate, directives, 0, CanadaGeo, 0);
    if (directives.hasOwnProperty('MLB') && MLB != '')
        /* Major League Baseball */
        misc.TimelineEvents(0, sdate, edate, directives, 0, MLB, 0);

    var arrayOfEvents = [], arrayOfEvents2 = [], arrayOfEvents3 = [], arrayOfBCEvents = [], arrayOfBCEvents2 = [], arrayOfBCEvents3 = [];
    if (tdata.length > 0)
        arrayOfEvents = tdata.split("\n");
    /* push BC dates into their own array since they will be sorted differently than AD dates */
    arrayOfEvents.slice(0).forEach ((el) => {
        if (el[6] == "-" || el[6] == "C") {
            arrayOfBCEvents.push(el);
            arrayOfEvents.splice(arrayOfEvents.indexOf(el), 1);      // delete element at currentindex
        }
    })
    /* go thru data; change 3-position alpha month to number; sort ascending by (1) year (2) month (3) day; go thru data again;
       change month number back to 3-position alpha month */
    var months = ["   ", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    arrayOfEvents.forEach ((el) => {
        var tel = ("   JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(el.substring(3,6)) / 3);
        tel = tel.toString();
        tel = tel.padStart(3);
        arrayOfEvents2.push(el.substring(0,3) + tel + el.substring(6));
    })
    arrayOfBCEvents.forEach ((el) => {
        var tel = ("   JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(el.substring(3,6)) / 3);
        tel = tel.toString();
        tel = tel.padStart(3);
        arrayOfBCEvents2.push(el.substring(0,3) + tel + el.substring(6));
    })
    /* sort AD events */
    arrayOfEvents2.sort((a,b) => parseInt(a.substring(7,11)) - parseInt(b.substring(7,11)) ||
                                 parseInt(a.substring(4,6)) - parseInt(b.substring(4,6)) ||
                                 parseInt(a.substring(0,2)) - parseInt(b.substring(0,2)));
    /* sort BC events */
    arrayOfBCEvents2.sort((a,b) => parseInt(b.substring(7,11)) - parseInt(a.substring(7,11)) ||
                                   parseInt(a.substring(4,6)) - parseInt(b.substring(4,6)) ||
                                   parseInt(a.substring(0,2)) - parseInt(b.substring(0,2)));
    /* change numeric month back to alpha abbreviation */
    arrayOfEvents2.forEach ((el) => {
        arrayOfEvents3.push(el.substring(0,3) + months[parseInt(el.substring(4,6))] + el.substring(6));
    })
    /* change numeric month back to alpha abbreviation */
    arrayOfBCEvents2.forEach ((el) => {
        arrayOfBCEvents3.push(el.substring(0,3) + months[parseInt(el.substring(4,6))] + el.substring(6));
    })

    /* Report look - do not show repeat event dates */
    if (directives.hasOwnProperty('DateRepeat')) {
        var pdate;

        if (arrayOfEvents3.length)
            for (i = 1, pdate = arrayOfEvents3[0].substring(0,11); i < arrayOfEvents3.length; i++)
                if (arrayOfEvents3[i].substring(0,11) == pdate)
                    arrayOfEvents3[i] = "           " + arrayOfEvents3[i].substring(11);
                else
                    pdate = arrayOfEvents3[i].substring(0,11);

        if (arrayOfBCEvents3.length)
            for (i = 1, pdate = arrayOfBCEvents3[0].substring(0,11); i < arrayOfBCEvents3.length; i++)
                if (arrayOfBCEvents3[i].substring(0,11) == pdate)
                    arrayOfBCEvents3[i] = "           " + arrayOfBCEvents3[i].substring(11);
                else
                    pdate = arrayOfBCEvents3[i].substring(0,11);
    }

    tdata = arrayOfBCEvents3.join("\n");
    TLRep += tdata + os.EOL;
    tdata = arrayOfEvents3.join("\n");
    TLRep += tdata + os.EOL;
    TLRep += os.EOL + "End of Events" + os.EOL;
    TLRep += "</pre> <script type=\"text/javascript\" src=\"clib.js\"></script> <button id='printPB' " +
             "onclick='userPrint(\"Timeline\")'>Print Timeline Report</button> </body> </html>";
    return TLRep;
}

/* validate ID entered in form */
function validateID (ID, ChildID) {
    var numdots = 0;
    for (var i = 0; i < ID.length; i++) {
        /* first & last characters of ID must be numeric */
        if (!i || i == (ID.length - 1)) {
            if (isNaN(ID[i]))
                return -1;
        } else {
            /* all other characters must be numeric or . (period) */
            if (isNaN(ID[i]) && ID[i] != '.')
                return -1;
            if (ID[i] == '.')
                numdots++;
        }
    }
    /* ID must contain at least one . (period) */
    if (!numdots)
        return -1;

    /* ChildID must be Roman Numerals */
    if (ChildID != -1 && ChildID != "")
        if (/[^i|v|x|l|c|d|m]/.test(ChildID))
            return -3;

    /* find location of head of family in familydata for ID, and find location of ChildID if applicable */
    var pos = familydata.indexOf("\n\n" + ID + "  ");
    if (pos == -1)
        return -2;
    else {
        pos += 2;            /* go to first position of ID */
        /* save name of individual */
        var npos = familydata.indexOf("  ", pos);
        if (ChildID == -1)
            famname = familydata.substring(npos + 2, familydata.indexOf("\n", npos));
        else
            indname = familydata.substring(npos + 2, familydata.indexOf("\n", npos));
        if (ChildID != -1 && ChildID != "") {
            var cpos = familydata.indexOf("Children", pos);
            while (1) {
                if (familydata[cpos] == "\n" && familydata[cpos + 1] == "\n" && familydata[cpos + 2] == "\n") {
                    /* did not find child */
                    return -4;
                }
                if (familydata.substring(cpos, cpos + ChildID.length + 4) == " " + ChildID + ".  ") {
                    /* found child; check if it has it's own family */
                    cpos--;
                    while (1) {
                        if (familydata[cpos] == "\n") {
                            /* child has no family of its own */

                            /* convert Roman Numeral to decimal number
                               the Roman Numeral has previously been validated */
                            childnum = convertRN2Dec(ChildID);
                            break;
                        }
                        if (isNaN (familydata[cpos])) { 
                            /* child seems to have a family of its own since it has an ID # attached */
                            return -5;
                        }
                        cpos--;
                    }
                    break;
                }
                cpos++;
            }
        }
        return pos;
    }
}

/* Roman Numeral to decimal converter from https://www.w3resource.com/javascript-exercises/javascript-math-exercise-22.php */
function convertRN2Dec(rn) {
    var num = char_to_int(rn.charAt(0));
    var pre, curr;

    for (var i = 1; i < rn.length; i++) {
        curr = char_to_int(rn.charAt(i));
        pre = char_to_int(rn.charAt(i - 1));
        if (curr <= pre)
            num += curr;
        else
            num = num - pre * 2 + curr;
    }

    return num;
}

function char_to_int(c) {
    switch (c) {
        case 'i':
            return 1;
        case 'v':
            return 5;
        case 'x':
            return 10;
        case 'l':
            return 50;
        case 'c':
            return 100;
        case 'd':
            return 500;
        case 'm':
            return 1000;
        default:
            return -1;
    }
}

module.exports = { Timeline };

