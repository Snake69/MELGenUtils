const misc = require ("./misc.js");
const os = require("os");

async function Point2Point (postdata) {
    var PPerrors = '';

    /* validate IDs */
    var x, dots, IDerr;
    postdata.Person1 = postdata.Person1.trim();
    postdata.Person2 = postdata.Person2.trim();
    if (postdata.Person1 == '' || postdata.Person2 == '')
        PPerrors += "Entries for both Person #1 and Person #2 are required.<br> <br>";
    else {
        if (isNaN(postdata.Person1[0]) || isNaN(postdata.Person1[postdata.Person1.length - 1]))
            PPerrors += "Person #1 - The first position and the last position of an ID must be a number.<br> <br>";
        if (isNaN(postdata.Person2[0]) || isNaN(postdata.Person2[postdata.Person2.length - 1]))
            PPerrors += "Person #2 - The first position and the last position of an ID must be a number.<br> <br>";
        for (x = dots = IDerr = 0; x < postdata.Person1.length; x++)
            if (postdata.Person1[x] < '0' || postdata.Person1[x] > '9')
                if (postdata.Person1[x] == '.')
                    dots++;
                else
                    IDerr = 1;
        if (IDerr || dots != 1)
            PPerrors += "Person #1 - An ID must contain only numbers and one, and only one, period.<br> <br>";
        for (x = dots = IDerr = 0; x < postdata.Person2.length; x++)
            if (postdata.Person2[x] < '0' || postdata.Person2[x] > '9')
                if (postdata.Person2[x] == '.')
                    dots++;
                else
                    IDerr = 1;
        if (IDerr || dots != 1)
            PPerrors += "Person #2 - An ID must contain only numbers and one, and only one, period.<br> <br>";
    }
    if (PPerrors == '') {
        /* ensure IDs exist within DB */
        var rDB = misc.ReadFamilyDB ();
        if (!rDB)
            PPerrors += "There are no family files for the active DataBase. Cannot produce report.<br> <br>";
        if (rDB == -1)
            PPerrors += "No Family DatBase is activated. Cannot produce report.<br> <br>";
        if (rDB == -2)
            PPerrors += "The DataBase is larger than 200MB and cannot be processed. Cannot produce report.<br> <br>";
        if (familydata.indexOf("\n\n" + postdata.Person1 + "  ") == -1)
            PPerrors += 'Person #1 - ID ' + postdata.Person1 + ' not found in the active Family DataBase.<br> <br>';
        if (familydata.indexOf("\n\n" + postdata.Person2 + "  ") == -1)
            PPerrors += 'Person #2 - ID ' + postdata.Person2 + ' not found in the active Family DataBase.<br> <br>';
    }

    if (PPerrors == "") {
        const PPReport = await processPoint2Point(postdata);
        return PPReport;
    } else {
        PPerrors = "ERRORS " + PPerrors;
        return PPerrors;
    }
}

async function processPoint2Point(pd) {
    var possPaths = [], gen, numdots, famgroup, x, y, z, paths, loc, endsw, steps = [], locPname, PID, Pname, pathsPtr, numberTimes, spouses = [],
        locFamgroup, PPrep = '';

    /* look for a connection between the two people */
    possPaths.length = steps.length = 0;
    possPaths.push([pd.Person1, -1, -1]);
    for (gen = 0, paths = 2; ; paths *= 2, gen = paths / 2 - 1) {
        for (endsw = x = 0; x < (paths / 2) && (gen + x) < possPaths.length; x++) {
            if (possPaths[gen + x][0] == -1)
                continue;
            else
                endsw = 1;
            if (possPaths[gen + x][0] == pd.Person2) {
                /* Person #1 & Person #2 are directly related */
                endsw = 1;
                /* save ID & pointer to pertinent possPaths entry */
                loc = familydata.indexOf("\n\n" + possPaths[gen + x][0] + "  ") + 2;
                steps.push (familydata.substring(loc, familydata.indexOf("  ", loc)));
                pathsPtr = gen + x;
                break;
            }
            if (possPaths[gen + x][0] != -1) {
                /* the existence of these Family Groups has already been checked */
                loc = familydata.indexOf("\n\n" + possPaths[gen + x][0] + "  ") + 2;
                /* get father */
                loc = familydata.indexOf("Father - ", loc) + 9;
                if (familydata[loc] >= '0' && familydata[loc] <= '9')
                    possPaths[gen + x][1] = familydata.substring(loc, familydata.indexOf(" ", loc));
                possPaths.push([possPaths[gen + x][1], -1, -1]);
                loc = familydata.indexOf("Mother - ", loc) + 9;
                if (familydata[loc] >= '0' && familydata[loc] <= '9')
                    possPaths[gen + x][2] = familydata.substring(loc, familydata.indexOf(" ", loc));
                possPaths.push([possPaths[gen + x][2], -1, -1]);
            }
        }
        if (!endsw)
            /* no more lineage */
            break;
    }
 
    if (!steps.length)
        /* Person #1 & Person #2 are not directly related */
        return "ERRORS " + pd.Person1 + " and " + pd.Person2 + " are NOT directly related.<br> <br>";
    else {
        /* prepare report */
        /* the css will hide the PRINT button and the system header from a hard copy print */
        PPrep += "<!doctype html> <html> <body id='Body'> <style type='text/css'> @media print { @page { margin-left: ";
        PPrep += "0.5in; margin-right: 0.5in; margin-top: 0; margin-bottom: 0; } #printPB { display: none; } } </style> <pre>";
        PPrep += os.EOL + "MELGenKey" + os.EOL + "Point to Point Ancestral Line Report" + os.EOL +
                          "Family DataBase - " + misc.ProcessDBSysInfo("DBName") + os.EOL + os.EOL + os.EOL;

        /* get all the steps between Person #1 & Person #2 */
        for (x = 0, y = pathsPtr - 1; y >= 0; y--)
            if (possPaths[y][1] != steps[x] && possPaths[y][2] != steps[x])
                continue;
            else {
                steps.push(possPaths[y][0]);
                x++;
            }
        /* output steps with requested data */
        if (pd.DFlow == 'E2L')
            x = steps.length - 1;
        else
            x = 0;
        numberTimes = 0;
        while (1) {
            loc = familydata.indexOf("\n\n" + steps[x] + "  ") + 2;
            famgroup = familydata.substring(loc, familydata.indexOf("\n\n\n", loc));
            locFamgroup = loc;
            PID = familydata.substring(loc, familydata.indexOf("  ", loc));
            locPname = familydata.indexOf("  ", loc) + 2;
            Pname = familydata.substring(locPname, familydata.indexOf("\n", locPname));
            spouses.length = 0;

            numdots = 0;
            if (numberTimes)
                for (y = 0; y < (Number(pd.Dots) + ((numberTimes - 1) * Number(pd.Dots))); y++) {
                    PPrep += ".";
                    numdots++;
                }
            numberTimes++;
            PPrep += Pname;   
            if (pd.ID == 'on' || pd.DOB == 'on' || pd.DOBYR == 'on' || pd.POB == 'on' || pd.DOD == 'on' || pd.DODYR == 'on' || pd.POD == 'on')
                PPrep += " (";   
            if (pd.ID == 'on') {
                PPrep += PID;   
                if (pd.DOB == 'on' || pd.DOBYR == 'on' || pd.POB == 'on' || pd.DOD == 'on' || pd.DODYR == 'on' || pd.POD == 'on')
                    PPrep += ", ";   
            }
            if (pd.DOB == 'on' || pd.DOBYR == 'on') {
                loc = famgroup.indexOf(Pname + " born");
                if (loc != -1) {
                    if (pd.DOD != 'on' && pd.DODYR != 'on')
                        PPrep += "born ";
                    loc = famgroup.lastIndexOf("\n", loc) + 1;
                        if (pd.DOBYR == 'on')
                            if (famgroup[loc + 6] == ' ')
                                PPrep += famgroup.substring(loc + 7, loc + 11);
                            else
                                PPrep += famgroup.substring(loc + 6, loc + 11);
                        else {
                            for (y = loc; y < (loc + 8); y++)
                                if (famgroup[y] != " ")
                                    break;
                            if (y != (loc + 8))
                                PPrep += famgroup.substring(y, loc + 11);
                        }
                } else
                    PPrep += "?";
            }
            if (pd.POB == 'on') {
                if (pd.DOB == 'on' || pd.DOBYR == 'on')
                    PPrep += " ";
                loc = famgroup.indexOf(Pname + " born ");
                if (loc != -1) {
                    loc = famgroup.indexOf(" born ", loc) + 5;
                    var necessaryStuff = famgroup.substring(loc, famgroup.indexOf("\n", loc)), previousLocation;
                    necessaryStuff = necessaryStuff.replace(' in ', ' ');
                    necessaryStuff = necessaryStuff.replace(' at ', ' ');
                    necessaryStuff = necessaryStuff.replace(' home, ', ' ');
                    necessaryStuff = necessaryStuff.replace(/\[.*?\]\s?/g, '').trim();  // remove Citation references
                    if (pd.ABBR == 'on') {
                        necessaryStuff = necessaryStuff.replace(' Township', ' Twp');
                        necessaryStuff = necessaryStuff.replace(' County', ' Co');
                        z = necessaryStuff.lastIndexOf(",", necessaryStuff.length - 1);
                        if (necessaryStuff.substring(z + 2).toLowerCase() == 'usa' || necessaryStuff.substring(z + 2).toLowerCase() == 'canada') {
                            /* if usa or canada go to the previous location string which should be a state or province/territoriy */
                            z = necessaryStuff.lastIndexOf(",", z - 1);
                            previousLocation = 1;
                        } else
                            previousLocation = 0;
                        if (z != -1) {
                            if (previousLocation)
                                var abbrev = regionNameToAbbreviation (necessaryStuff.substring((z + 2), necessaryStuff.indexOf(',', z + 2)));
                            else
                                var abbrev = regionNameToAbbreviation (necessaryStuff.substring(z + 2));
                            if (abbrev != null)
                                necessaryStuff = necessaryStuff.replace(necessaryStuff.substring(z + 2), abbrev);
                        }
                    }
                    PPrep += necessaryStuff;
                }
            }
            if (pd.ID == 'on' || pd.DOB == 'on' || pd.DOBYR == 'on' || pd.POB == 'on')
                if ((pd.DOB == 'on' || pd.DOBYR == 'on' || pd.POB == 'on') && (pd.DOD == 'on' || pd.DODYR == 'on' || pd.POD == 'on'))
                    PPrep += " - ";

            if (pd.ID != 'on' && pd.DOB != 'on' && pd.DOBYR != 'on' && pd.POB != 'on' && (pd.DOD == 'on' || pd.DODYR == 'on' || pd.POD == 'on'))
                PPrep += " ( - ";   
            if (pd.DOD == 'on' || pd.DODYR == 'on') {
                loc = famgroup.indexOf(Pname + " died");
                if (loc != -1) {
                    if (pd.DOB != 'on' && pd.DOBYR != 'on')
                        PPrep += "died ";
                    loc = famgroup.lastIndexOf("\n", loc) + 1;
                        if (pd.DODYR == 'on')
                            if (famgroup[loc + 6] == ' ')
                                PPrep += famgroup.substring(loc + 7, loc + 11);
                            else
                                PPrep += famgroup.substring(loc + 6, loc + 11);
                        else {
                            for (y = loc; y < (loc + 8); y++)
                                if (famgroup[y] != " ")
                                    break;
                            if (y != (loc + 8))
                                PPrep += famgroup.substring(y, loc + 11);
                        }
                } else
                    PPrep += "?";
            }
            if (pd.POD == 'on') {
                if (pd.DOD == 'on' || pd.DODYR == 'on')
                    PPrep += " ";
                loc = famgroup.indexOf(Pname + " died ");
                if (loc != -1) {
                    loc = famgroup.indexOf(" died ", loc) + 5;
                    var necessaryStuff = famgroup.substring(loc, famgroup.indexOf("\n", loc), previousLocation);
                    necessaryStuff = necessaryStuff.replace(' in ', ' ');
                    necessaryStuff = necessaryStuff.replace(' at ', ' ');
                    necessaryStuff = necessaryStuff.replace(' home, ', ' ');
                    necessaryStuff = necessaryStuff.replace(/\[.*?\]\s?/g, '').trim();  // remove Citation references
                    if (pd.ABBR == 'on') {
                        necessaryStuff = necessaryStuff.replace(' Township', ' Twp');
                        necessaryStuff = necessaryStuff.replace(' County', ' Co');
                        z = necessaryStuff.lastIndexOf(",", necessaryStuff.length - 1);
                        if (necessaryStuff.substring(z + 2).toLowerCase() == 'usa' || necessaryStuff.substring(z + 2).toLowerCase() == 'canada') {
                            /* if usa or canada go to the previous location string which should be a state or province/territoriy */
                            z = necessaryStuff.lastIndexOf(",", z - 1);
                            previousLocation = 1;
                        } else
                            previousLocation = 0;
                        if (z != -1) {
                            if (previousLocation)
                                var abbrev = regionNameToAbbreviation (necessaryStuff.substring((z + 2), necessaryStuff.indexOf(',', z + 2)));
                            else
                                var abbrev = regionNameToAbbreviation (necessaryStuff.substring(z + 2));
                            if (abbrev != null)
                                necessaryStuff = necessaryStuff.replace(necessaryStuff.substring(z + 2), abbrev);
                        }
                    }
                    PPrep += necessaryStuff;
                }
            }
            if (pd.ID == 'on' || pd.DOB == 'on' || pd.DOBYR == 'on' || pd.POB == 'on' || pd.DOD == 'on' || pd.DODYR == 'on' || pd.POD == 'on')
                PPrep += ")";
            PPrep += os.EOL;

            if (pd.Spouse == 'on') {
                /* add all spouses */

                /* look in Timeline Section for marriages */
                loc = 0;
                while (1) {
                    loc = famgroup.indexOf(Pname + " and ", loc);
                    if (loc != -1) {
                        loc = famgroup.indexOf(" and ", loc);
                        var loc2 = famgroup.lastIndexOf("\n", loc) + 1;
                        var line = famgroup.substring(loc2, famgroup.indexOf("\n", loc2));
                        loc2 = line.indexOf(" married");
                        if (loc2 != -1) {
                            loc += 5;
                            spouses.push(famgroup.substring(loc, famgroup.indexOf(" married", loc)));
                        }
                        loc = famgroup.indexOf("\n", loc) + 1;
                    } else
                        break;
                }

                /* look in Notes Section for marriages */
                loc = 0;
                while (1) {
                    loc = famgroup.indexOf(" married ", loc);
                    if (loc != -1) {
                        if (misc.DetermineSection (locFamgroup + loc) == "Notes") {
                            var loc2 = famgroup.lastIndexOf("\n\n", loc) + 2;
                            if (famgroup.substring(loc2, famgroup.indexOf("\n", loc2)) == "Notes -")
                                loc2 = famgroup.indexOf("\n", loc2) + 1;
                            if (famgroup.substring(loc2, loc2 + Pname.length) == Pname) {
                                var line = famgroup.substring(loc + 9, famgroup.indexOf("\n", loc));
                                for (z = 0; z < line.length; z++)
                                    /* look for the first occurrence of ;[\n */
                                    if (line[z] == ';' || line[z] == '\n' || line[z] == '[') {
                                        loc2 = z;
                                        break;
                                    }
                                if (z == line.length)
                                    z = line.length;
                                while (line[z] == ' ' || line[z] == '.')
                                    z--;
                                var spread = 0;
                                if (line.substring(0,5) == "first" || line.substring(0,5) == "third" || line.substring(0,5) == "fifth" ||
                                                                                                           line.substring(0,5) == "sixth")
                                    spread = 6;
                                if (line.substring(0,6) == "second" || line.substring(0,6) == "fourth")
                                    spread = 7;
                                spouses.push(line.substring(0 + spread, z));
                            }
                        }
                        loc = famgroup.indexOf("\n", loc) + 1;
                    } else
                        break;
                }
                for (z = 0; z < spouses.length; z++) {
                    for (y = 0; y < numdots; y++)
                        PPrep += ' ';
                    PPrep += '+' + spouses[z];
                    PPrep += os.EOL;
                }
            }

            if (pd.DFlow == 'E2L')
                if (!x)
                    break;
                else
                    x--;
            else
                if (x == (steps.length - 1))
                    break;
                else
                    x++;
        }
        PPrep += os.EOL + os.EOL;
    }

    PPrep += "</pre> <script type=\"text/javascript\" src=\"clib.js\"></script> <button id='printPB' " +
             "onclick='userPrint(\"Timeline\")'>Print Point2Point Report</button> </body> </html>";
    return PPrep;
}

/* from https://gist.github.com/calebgrove/c285a9510948b633aa47 */
function regionNameToAbbreviation (name) {
    let regions = {
        "arizona": "AZ",
        "alabama": "AL",
        "alaska": "AK",
        "arkansas": "AR",
        "california": "CA",
        "colorado": "CO",
        "connecticut": "CT",
        "district of columbia": "DC",
        "delaware": "DE",
        "florida": "FL",
        "georgia": "GA",
        "hawaii": "HI",
        "idaho": "ID",
        "illinois": "IL",
        "indiana": "IN",
        "iowa": "IA",
        "kansas": "KS",
        "kentucky": "KY",
        "louisiana": "LA",
        "maine": "ME",
        "maryland": "MD",
        "massachusetts": "MA",
        "michigan": "MI",
        "minnesota": "MN",
        "mississippi": "MS",
        "missouri": "MO",
        "montana": "MT",
        "nebraska": "NE",
        "nevada": "NV",
        "new hampshire": "NH",
        "new jersey": "NJ",
        "new mexico": "NM",
        "new york": "NY",
        "north carolina": "NC",
        "north dakota": "ND",
        "ohio": "OH",
        "oklahoma": "OK",
        "oregon": "OR",
        "pennsylvania": "PA",
        "rhode island": "RI",
        "south carolina": "SC",
        "south dakota": "SD",
        "tennessee": "TN",
        "texas": "TX",
        "utah": "UT",
        "vermont": "VT",
        "virginia": "VA",
        "washington": "WA",
        "west virginia": "WV",
        "wisconsin": "WI",
        "wyoming": "WY",
        "american samoa": "AS",
        "guam": "GU",
        "northern mariana islands": "MP",
        "puerto rico": "PR",
        "us virgin islands": "VI",
        "us minor outlying islands": "UM",

        "alberta": "AB",
        "british columbia": "BC",
        "manitoba": "MB",
        "new brunswick": "NB",
        "newfoundland": "NF",
        "northwest territory": "NT",
        "nova scotia": "NS",
        "nunavut": "NU",
        "ontario": "ON",
        "prince edward island": "PE",
        "quebec": "QC",
        "saskatchewan": "SK",
        "yukon": "YT"
    }

    /* trim, remove all non-word characters with the exception of spaces, and convert to lowercase */
    let a = name.trim().replace(/[^\w ]/g, "").toLowerCase();
    if (regions[a] !== null)
        return regions[a];

    return null;
}

module.exports = { Point2Point };

