const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const misc = require ("./misc.js");

async function Inspect () {
    /* user wants to Inspect the active DataBase */

    /* read family data (all body files) for active DataBase if it hasn't already been read */
    var rDB = misc.ReadFamilyDB (), insErrs = '';
    if (!rDB)
        insErrs += "There are no family files for the active DataBase. Inspection not done." + os.EOL + os.EOL;
    if (rDB == -2)
        insErrs += "The DataBase is larger than 200MB and cannot be processed. Inspection not done." + os.EOL + os.EOL;
    if (insErrs == "") {
        const InsReport = await DoInspect ();
        return InsReport;
    } else {
        insErrs = "ERRORS " + insErrs;
        return insErrs;
    }
}

async function DoInspect () {
    var fdpos, famgroup, timelineSection, hofSection, citationSection, childrenSection, FamID, notesSection, questionsSection, extrasSection,
        explanationsSection, observationsSection, cntErrors = 0, cntWarnings = 0, cntInfos = 0, InsRep;

    InsRep = '';

    /* the css will hide the PRINT button and the system header from a hard copy print */
    InsRep += "<!doctype html> <html> <body id='Body'> <style type='text/css'> @media print { @page { margin-left: 0.5in; margin-right: 0.5in; ";
    InsRep += " margin-top: 0; margin-bottom: 0; } #printPB { display: none; } } </style> <pre>" + os.EOL + "MELGenKey" + os.EOL;
    InsRep += "Inspection Report" + os.EOL + "for Family DataBase " + misc.ProcessDBSysInfo("DBName") + os.EOL + os.EOL;

    /* point to first character in familydata */
    for (fdpos = 0; fdpos < familydata.length; fdpos++)
        if (familydata[fdpos] >= '0' && familydata[fdpos] <= '9')
            break;

    if (fdpos >= familydata.length) {
        InsRep += "There doesn't seem to be any family data to inspect." + os.EOL;
        verifyerr = 1;
    }

    /* go through familydata */
    while (1) {
        /* extract Family Group */
        var endFamGroup = familydata.indexOf("\n\n\n", fdpos);
        if (endFamGroup != -1) {
            famgroup = familydata.substring(fdpos, endFamGroup + 1);
            fdpos = endFamGroup + 4;     // point to first position of next Family Group
        } else
            break;

        /* get Family Group ID */
        FamID = famgroup.substring(0, famgroup.indexOf(" "));

        /* extract Head of Family Section */
        var Tend = famgroup.indexOf("-\n");
        Tend = famgroup.lastIndexOf("\n\n", Tend) + 1;
        hofSection = famgroup.substring(0, Tend)

        /* extract Citation Section */
        var TbeginC = famgroup.indexOf("Citation -");
        if (TbeginC == -1)
            TbeginC = famgroup.indexOf("Citations -") + 12;
        else
            TbeginC += 11;
        citationSection = famgroup.substring(TbeginC, famgroup.indexOf("\n\nChildren", TbeginC) + 1);

        /* extract Children Section */
        var TbeginCh = famgroup.indexOf("\n\nChildren");
        TbeginCh = famgroup.indexOf("\n\n", TbeginCh) + 2;
        childrenSection = famgroup.substring(TbeginCh, famgroup.indexOf("\n\n\n\n", TbeginCh) + 1);

        /* extract various sections from famgroup if they exist */
        notesSection = getSection (famgroup, "Notes");
        questionsSection = getSection (famgroup, "Questions");
        extrasSection = getSection (famgroup, "Extras");
        explanationsSection = getSection (famgroup, "Explanations");
        observationsSection = getSection (famgroup, "Observations");

        /* extract Timeline Section if it exists */
        var Tbegin = famgroup.indexOf("Timeline -");
        if (Tbegin != -1)
            timelineSection = famgroup.substring(Tbegin + 11, famgroup.indexOf("\n\n", Tbegin + 11) + 1);
        else
            timelineSection = "";

        /* Family Group checks */
        if (timelineSection != "") {
            var Tpnt, Bpnt, multiMatch = [];
            /* look for more than one birth event for the same person */
            for (multiMatch.length = Tpnt = 0; Tpnt < timelineSection.length; ) {
                Tpnt = timelineSection.indexOf(" born", Tpnt);
                if (Tpnt == -1)
                    break;
                else {
                    Bpnt = timelineSection.lastIndexOf("\n", Tpnt);
                    if (Bpnt == -1)
                        Bpnt = 12;
                    else
                        Bpnt += 13;
                    var cnt = look4MoreThan1(timelineSection, timelineSection.substring(Bpnt, Tpnt + 5), Tpnt + 5);
                    if (cnt > 1) {
                        for (var x = 0; x < multiMatch.length; x++)
                            if (timelineSection.substring(Bpnt, Tpnt + 5) == multiMatch[x])
                                break;
                        if (x >= multiMatch.length) {
                            InsRep += 'ERROR - "' + timelineSection.substring(Bpnt, Tpnt) + '" has ' + cnt + " birth events in Family Group " +
                                      FamID + os.EOL;
                            cntErrors++;
                            multiMatch.push (timelineSection.substring(Bpnt, Tpnt + 5));
                        }
                    }
                    Tpnt = timelineSection.indexOf("\n", Tpnt) + 1;
                }
            }

            /* look for more than one baptismal event for the same person */
            for (multiMatch.length = Tpnt = 0; Tpnt < timelineSection.length; ) {
                Tpnt = timelineSection.indexOf(" baptized", Tpnt);
                if (Tpnt == -1)
                    break;
                else {
                    Bpnt = timelineSection.lastIndexOf("\n", Tpnt);
                    if (Bpnt == -1)
                        Bpnt = 12;
                    else
                        Bpnt += 13;
                    var cnt = look4MoreThan1(timelineSection, timelineSection.substring(Bpnt, Tpnt + 9), Tpnt + 9);
                    if (cnt > 1) {
                        for (var x = 0; x < multiMatch.length; x++)
                            if (timelineSection.substring(Bpnt, Tpnt + 9) == multiMatch[x])
                                break;
                        if (x >= multiMatch.length) {
                            InsRep += 'ERROR - "' + timelineSection.substring(Bpnt, Tpnt) + '" has ' + cnt +
                                      " baptismal events in Family Group " + FamID + os.EOL;
                            cntErrors++;
                            multiMatch.push (timelineSection.substring(Bpnt, Tpnt + 9));
                        }
                    }
                    Tpnt = timelineSection.indexOf("\n", Tpnt) + 1;
                }
            }

            /* look for more than one death event for the same person */
            for (multiMatch.length = Tpnt = 0; Tpnt < timelineSection.length; ) {
                Tpnt = timelineSection.indexOf(" died", Tpnt);
                if (Tpnt == -1)
                    break;
                else {
                    Bpnt = timelineSection.lastIndexOf("\n", Tpnt);
                    if (Bpnt == -1)
                        Bpnt = 12;
                    else
                        Bpnt += 13;
                    var cnt = look4MoreThan1(timelineSection, timelineSection.substring(Bpnt, Tpnt + 5), Tpnt + 5);
                    if (cnt > 1) {
                        for (var x = 0; x < multiMatch.length; x++)
                            if (timelineSection.substring(Bpnt, Tpnt + 5) == multiMatch[x])
                                break;
                        if (x >= multiMatch.length) {
                            InsRep += 'ERROR - "' + timelineSection.substring(Bpnt, Tpnt) + '" has ' + cnt + " death events in Family Group " +
                                      FamID + os.EOL;
                            cntErrors++;
                            multiMatch.push (timelineSection.substring(Bpnt, Tpnt + 5));
                        }
                    }
                    Tpnt = timelineSection.indexOf("\n", Tpnt) + 1;
                }
            }

            /* look for more than one buried event for the same person */
            for (multiMatch.length = Tpnt = 0; Tpnt < timelineSection.length; ) {
                Tpnt = timelineSection.indexOf(" buried", Tpnt);
                if (Tpnt == -1)
                    break;
                else {
                    Bpnt = timelineSection.lastIndexOf("\n", Tpnt);
                    if (Bpnt == -1)
                        Bpnt = 12;
                    else
                        Bpnt += 13;
                    var cnt = look4MoreThan1(timelineSection, timelineSection.substring(Bpnt, Tpnt + 7), Tpnt + 7);
                    if (cnt > 1) {
                        for (var x = 0; x < multiMatch.length; x++)
                            if (timelineSection.substring(Bpnt, Tpnt + 7) == multiMatch[x])
                                break;
                        if (x >= multiMatch.length) {
                            InsRep += 'ERROR - "' + timelineSection.substring(Bpnt, Tpnt) + '" has ' + cnt + " buried events in Family Group " +
                                      FamID + "; if this is actually correct and the person's burial " +
                                     "location was moved, replace the word 'buried' with 'reburied' in the Plain Text version of the Family " +
                                     "DataBase for burial events after the initial one for this person." + os.EOL;
                            cntErrors++;
                            multiMatch.push (timelineSection.substring(Bpnt, Tpnt + 7));
                        }
                    }
                    Tpnt = timelineSection.indexOf("\n", Tpnt) + 1;
                }
            }
        }
    }

    InsRep += os.EOL + "Number of ERROR messages - " + cntErrors + os.EOL;
    InsRep += "Number of WARNING messages - " + cntWarnings + os.EOL;
    InsRep += "Number of INFO messages - " + cntInfos + os.EOL;
    InsRep += os.EOL + "End of Inspection Report" + os.EOL;
    InsRep += "</pre> <script type=\"text/javascript\" src=\"clib.js\"></script> <button id='printPB' " +
              "onclick='userPrint(\"Inspect\")'>Print Inspection Report</button> </body> </html>";

    return InsRep;
}

function look4MoreThan1(TL, str, pnt) {
    let count = 1;
    let position = pnt;

    while (true) {
        position = TL.indexOf(str, position);
        if (position === -1)
            break;
        if (TL[position - 13] == '\n')  // if the match is not at the beginning of the event line (excluding the date) then it's not a true match
            count++;                    // e.g., looking for "Charles Lake born" but what it matches on is actually "John Charles Lake born"
        position += str.length;         // which would be a different person
    }

    return count;
}

function getSection (famgroup, sectionName) {
    var searchStrings = ["\n\nNotes -\n", "\n\nQuestions -\n", "\n\nExtras -\n", "\n\nExplanations -\n", "\n\nObservations -\n",
                         "\n\nCitation -\n", "\n\nCitations -\n"], beginSection;
    let minIndex = Infinity;

    beginSection = famgroup.indexOf(sectionName);
    if (beginSection == -1)
        return "";
    beginSection = famgroup.indexOf("\n", beginSection) + 1;

    for (const searchString of searchStrings) {
        const index = famgroup.indexOf(searchString, beginSection);
        if (index !== -1 && index < minIndex)
            minIndex = index;
    }

    if (minIndex === Infinity)
        return "";
    else
        return famgroup.substring(beginSection, minIndex + 1);
}

function extractPersonId(lineText) {
    const childMatch = lineText.match(/child #\d+/i);
    if (childMatch) {
        const childId = childMatch[0].toLowerCase();
        const nameMatch = lineText.match(/child #\d+,\s*(.+?)\s+(born|baptized|died|buried|married)/i);
        if (nameMatch)
            return `${childId}: ${nameMatch[1].trim()}`;
    }

    const eventMatch = lineText.match(/(.+?)\s+(born|baptized|died|buried|married)/i);
    if (eventMatch)
        return eventMatch[1].trim(); // includes qualifiers like (Sr)

    return null;
}

module.exports = { Inspect };

