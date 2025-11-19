const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const Fuse = require("fuse.js");
const misc = require ("./misc.js");

async function Verify (infomsg, autodel, disable) {
    /* user wants to Verify the active DataBase */

    /* force read of family data (all body files) for active DataBase in case user is rerunning Verify after changing/correcting data */
    var rDB = misc.ReadFamilyDB ("FORCE"), verErrs = '';
    if (!rDB)
        verErrs += "There are no family files for the active DataBase. Verification not done." + os.EOL + os.EOL;
    if (rDB == -2)
        verErrs += "The DataBase is larger than 200MB and cannot be processed. Verification not done." + os.EOL + os.EOL;
    if (verErrs == "") {
        const VerReport = await DoVerify (infomsg, autodel, disable);
        return VerReport;
    } else {
        verErrs = "ERRORS " + verErrs;
        return verErrs;
    }
}

var verifyerr, multipleCitations, VerReport;

async function DoVerify (isw, autodel, disable) {
    var fdpos, linepos, famgroup, fgpos, linecnt = 0, indexlc = 0, nindexlc, ID, toomanycr, fgcnt = 0, HOFline, conseol,
        Fline, Mline, TL, splitID = [''], splitPrevID = [''], prevID = -1, idpos, workpos1, workpos2, workdata, chsplit = [''], pnt,
        indexac = 0, stayhere, OPENsw = 0, refsdel = 0, ilinesdel= 0, citeSection;

    VerReport = '';
    verifyerr = 0;

    /* options for fuzzy matching */
    const FuseOptions = {
        isCaseSensitive: true,
        includeScore: true,
        findAllMatches: true,
        threshold: 0.5,
    };

    /* delete HTML version of active DB if it exists */
    var DBloc = misc.ProcessDBSysInfo ("DBLocation");
    var res = fs.existsSync(path.normalize(DBloc + '/HTML/tableofcontents.html'));
    if (res) {
        try {
            /* remove HTML version */
            fs.rmSync(path.normalize(DBloc + "/HTML"), { recursive: true, force: true });
            misc.Logging("Deleted HTML version of active Family DataBase.");
        }
        catch (err) {
            misc.Logging(err + "; problem deleting HTML version of active Family DataBase.");
            /* continue with verification */
        }
    }

    /* the css will hide the PRINT button and the system header from a hard copy print */
    VerReport += "<!doctype html> <html> <body id='Body'> <style type='text/css'> @media print { @page { margin-left: 0.5in; margin-right: " +
                 "0.5in; ";
    VerReport += " margin-top: 0; margin-bottom: 0; } #printPB { display: none; } } </style> <pre>";
    VerReport += os.EOL + "MELGenKey" + os.EOL + "Verify Report" + os.EOL + os.EOL;

    /* point to first character in familydata */
    fdpos = 0;
    for (linepos = 0; fdpos < familydata.length; fdpos++)
        if (familydata[fdpos] == "\n") {
            linepos = 0;
            linecnt++;
        } else
            if (familydata[fdpos] >= '0' && familydata[fdpos] <= '9')
                break;
            else
                linepos++;
                
    if (linepos) {
        VerReport += "The first character in the first Family Group must be in column 1." + os.EOL;
        verifyerr++;
    }
    if (fdpos >= familydata.length) {
        VerReport += "There doesn't seem to be any data to verify." + os.EOL;
        verifyerr++;
    }

    /* go through familydata */
    let sseMainLoopCounter = 0;
    while (1) {
        famgroup = "";
        citeSection = "";

        for ( ; fdpos < familydata.length; fdpos++) {
            /* extract Family Group */
            famgroup += familydata[fdpos];
            if (familydata[fdpos] == "\n") {
                linecnt++;      /* running count of lines in the familydata */
                if (familydata[fdpos - 1] == "\n" && familydata[fdpos - 2] == "\n" && familydata[fdpos - 3] == "\n") {
                    /* four consecutive carriage returns (3 null lines) ends Family Group */
                    fdpos++;    /* point to first position of next Family Group */
                    fgcnt++;    /* running count of Family Groups */
                    break;
                }
            }
        }
        const fuse = new Fuse(famgroup.split("\n"), FuseOptions);   /* fuse needs an array; it doesn't work on 1 var for whatever reason */

        sseMainLoopCounter++;
        if (sseMainLoopCounter % 100 === 0) {
            const progressPercentage = Math.trunc((fdpos / familydata.length) * 100);

            // Send update to ALL connected clients
            sseClients.forEach(client => {
                client.res.write("event: verify-progress-update\n");
                client.res.write(`data: ${JSON.stringify({ message: "FB" + progressPercentage })}\n\n`);
            })
            await new Promise(resolve => setImmediate(resolve));
        }

        if (fdpos >= familydata.length && famgroup == "")
            /* end of familydata */
            break;

        toomanycr = 0;
        while (familydata[fdpos] == "\n" && fdpos < familydata.length) {
            /* too many CRs separating Family Groups */
            toomanycr++;
            fdpos++;
            linecnt++;
        }

        /* get Head of Family ID(s) for Family Group (there can be multiple HOFs) */
        fgpos = 0;
        while (1) {
            if (fgpos >= famgroup.length)
                /* end of Family Group */
                break;

            ID = famgroup.substring(fgpos, famgroup.indexOf(" ", fgpos));

            if (toomanycr) {
                VerReport += "ID " + ID + " - Too many blank lines following Family Group. There should be three blank lines." + os.EOL;
                verifyerr++;
            }
            if (isNaN(ID[0]) || isNaN(ID[ID.length - 1])) {
                VerReport += "ID " + ID + " - The first position and the last position in an ID must be a number." + os.EOL;
                verifyerr++;
            }
            if (ID.indexOf(".") == -1) {
                VerReport += "ID " + ID + " - An ID must contain at least one period." + os.EOL;
                verifyerr++;
            }
            splitID = ID.split('.');
            if (prevID != -1) {
                /* ensure Family Group ID is greater than previous ID */
                splitPrevID = prevID.split('.');
                if (splitID[0] == splitPrevID[0]) {
                    if (Number (splitID[1]) > (Number (splitPrevID[1]) + 1))
                        if (isw > 0)
                            VerReport += "ID " + ID + " - [info] There is a numerical sequence gap between this Family Group ID " +
                                         "(or Head of Family) and the previous one." + os.EOL;
                    if (Number (splitID[1]) <= Number (splitPrevID[1])) {
                        VerReport += "ID " + ID + " - The number to the right of the period in the ID must be greater than the previous ID." +
                                     os.EOL;
                        verifyerr++;
                    }
                }
                if (Number (splitID[0]) > Number (splitPrevID[0]))
                    if (splitID[1] != 0)
                        if (isw > 0)
                            VerReport += "ID " + ID + " - [info] The number to the right of the period in the ID should = 0 when there is an " +
                                         "increase in the number to the left of the period from the previous Family Group ID." + os.EOL;
                if (Number (splitID[0]) < Number (splitPrevID[0])) {
                    VerReport += "ID " + ID + " - The number to the left of the period in the ID cannot be less than the previous one." + os.EOL;
                    verifyerr++;
                }
            }
            prevID = ID;

            HOFline = famgroup.substring(fgpos, famgroup.indexOf("\n", fgpos));
            if (HOFline.indexOf(" OPEN") != -1) {
                OPENsw = 1;
                if (isw > 0)
                    VerReport += "ID " + ID + " - [info] Family Group ID marked as OPEN." + os.EOL;
                break;   /* no more checks for this "Family Group" */
            }
            Fline = famgroup.indexOf("\n", fgpos) + 1;
            Mline = famgroup.indexOf("\n", Fline) + 1;
            if (famgroup.substring(Fline, famgroup.indexOf("\n", Fline)) != "Father - name unknown" ||
                famgroup.substring(Mline, famgroup.indexOf("\n", Mline)) != "Mother - name unknown") {
                /* look for Family Group ID being a child in another family; ID & name (except surname) must match */
                idpos = 0;
                stayhere = 1;
                while (stayhere) {
                    /* if parent ID falls within disable range then don't do this check */
                    var FlineT, MlineT, FIDG, MIDG;
                    FIDG = MIDG = 0;
                    FlineT = famgroup.substring(Fline + 9, famgroup.indexOf("\n", Fline + 9));
                    MlineT = famgroup.substring(Mline + 9, famgroup.indexOf("\n", Mline + 9));
                    if (FlineT.indexOf("name unknown") == -1 && FlineT[0] != ' ') {
                        FIDG = FlineT.substring(0, FlineT.indexOf('.'));
                        if (Number(FIDG < Number(disable)))
                            break;
                    } else
                        if (MlineT.indexOf("name unknown") == -1 && MlineT[0] != ' ') {
                            MIDG = MlineT.substring(0, MlineT.indexOf('.'));
                            if (Number(MIDG < Number(disable)))
                                break;
                        }

                    idpos = familydata.indexOf(ID + '  ', idpos);
                    if (idpos == -1) {
                        VerReport += 'ID ' + ID + ' - Family Group ID not found as a child in another Family Group.' + os.EOL;
                        verifyerr++;
                        break;
                    } else {
                        /* check for other stuff */
                        if (familydata[idpos - 1] != "\n") {     /* ID must appear at beginning of line */
                            idpos++;
                            continue;
                        }
                        for (workpos1 = idpos; workpos1 != 0; workpos1--) {
                            if (familydata[workpos1] == "\n" && familydata[workpos1 + 1] == "\n") {
                                for (workpos2 = workpos1 - 1; workpos2 != 0; workpos2--) {
                                    if (familydata[workpos2] == "\n" && familydata[workpos2 + 1] == "\n") {
                                        workdata = familydata.substring(workpos2, workpos1);
                                        if (workdata.indexOf("Children") == -1) {
                                            workpos2 = 0;
                                            break;
                                        } else {
                                            /* found ID in a Children Section; ensure name matches */
                                            var wt = familydata.substring(idpos, familydata.indexOf("\n", idpos));
                                            workdata = wt.replaceAll('.', ' ');      /* get rid of periods */
                                            chsplit = workdata.split(' ');

                                            var tsw = 0;
                                            for (var i in chsplit) {
                                                if (chsplit[i] == '')
                                                    continue;
                                                if (chsplit[i].search(/\d/) != -1)  /* array element contains any numerics (ID) */
                                                    continue;
                                                if (/^[ivx]+$/.test(chsplit[i]))    /* array element contains only i, v and/or x (child #) */
                                                    continue;
                                                if (HOFline.indexOf(chsplit[i]) == -1) {
                                                    if (HOFline.indexOf("------")) {
                                                        stayhere = 0;
                                                        break;
                                                    }
                                                    tsw = 1;
                                                    workpos2 = 0;
                                                    verifyerr++;
                                                    VerReport += 'ID ' + ID + ' - Family Group ID found as a child in another Family Group but ' +
                                                                 'name does not match.' + os.EOL;
                                                    break;
                                                } else
                                                    tsw = 2;
                                            }
                                            if (tsw == 2) {
                                                if (isw > 1)
                                                    VerReport += 'ID ' + ID + ' - [info] Found Family Group ID as a child.' + os.EOL;
                                                stayhere = 0;
                                            }
                                            workpos2 = 0;
                                            break;
                                        }
                                    }
                                }
                                if (workpos2 == 0) {
                                    workpos1 = 0;
                                    break;
                                }
                            }
                        }
                        if (workpos1 == 0) {
                            idpos++;
                            continue;
                        }
                    }
                }
            }

            Fline = famgroup.indexOf("Father - ", fgpos);
            if (Fline == -1) {
                VerReport += 'ID ' + ID + ' - A "Father - " line is required after the Head of Family line.' + os.EOL;
                verifyerr++;
            } else {
                Fline = famgroup.substring(Fline + 9, famgroup.indexOf("\n", Fline + 9));
                if (Fline.indexOf("name unknown") == -1 && Fline[0] != ' ' &&
                               Number(Fline.substring(0, Fline.indexOf("."))) >= Number(disable) && familydata.indexOf("\n\n" + Fline) == -1) {
                    VerReport += 'ID ' + ID + ' - Family Group for "' + Fline + '" not found.' + os.EOL;
                    verifyerr++;
                }
            }
            var Mlinepos = famgroup.indexOf("Mother - ", fgpos);
            if (Mlinepos == -1) {
                VerReport += 'ID ' + ID + ' - A "Mother - " line is required after the "Father - " line.' + os.EOL;
                verifyerr++;
                break;
            } else {
                Mline = famgroup.substring(Mlinepos + 9, famgroup.indexOf("\n", Mlinepos + 9));
                if (Mline.indexOf("name unknown") == -1 && Mline[0] != ' ' &&
                               Number(Mline.substring(0, Mline.indexOf("."))) >= Number(disable) && familydata.indexOf("\n\n" + Mline) == -1) {
                    VerReport += 'ID ' + ID + ' - Family Group for "' + Mline + '" not found.' + os.EOL;
                    verifyerr++;
                }

                /* check for another HOF */
                Fline = famgroup.indexOf("Father - ", Mlinepos);
                if (Fline == -1)
                    break;
                else {
                    /* back up to beginning of previous line (HOF line) */
                    fgpos = famgroup.lastIndexOf("\n\n", Fline);
                    if (fgpos == -1) {
                        VerReport += 'ID ' + ID + ' - Something is wrong with the format of this Family Group. Perhaps there should be a null ' +
                                     'line between Head of Family sections.' + os.EOL;
                        break;
                    }
                    fgpos += 2;
                }
            }
        }

        if (OPENsw) {
            OPENsw = 0;
            continue;
        }
        var Chpnt = famgroup.indexOf("Children:");
        var ChBypnt = famgroup.indexOf("Children by ");
        var CChpnt, x;
        if (Chpnt == -1 && ChBypnt == -1) {
            VerReport += 'ID ' + ID + ' - A "Children:" or "Children by " Section is required.' + os.EOL;
            verifyerr++;
        } else
            if (Chpnt != -1 && ChBypnt != -1) {
                VerReport += 'ID ' + ID + ' - There can be only one Children Section in a Family Group.' + os.EOL;
                verifyerr++;
            } else {
                if (Chpnt != -1)
                    CChpnt = Chpnt;
                else
                    CChpnt = ChBypnt;
                if (famgroup.indexOf("Timeline -", CChpnt) != -1 || famgroup.indexOf("Notes -", CChpnt) != -1 ||
                              famgroup.indexOf("Extras -", CChpnt) != -1 || famgroup.indexOf("Explanations -", CChpnt) != -1 ||
                              famgroup.indexOf("Citation -", CChpnt) != -1 || famgroup.indexOf("Source -", CChpnt) != -1 ||
                              famgroup.indexOf("Citations -", CChpnt) != -1 || famgroup.indexOf("Sources -", CChpnt) != -1 ||
                              famgroup.indexOf("Questions -", CChpnt) != -1) {
                    VerReport += 'ID ' + ID + ' - The Children Section must be the last section in a Family Group.' + os.EOL;
                    verifyerr++;
                }
                if (famgroup.indexOf("Children:", CChpnt + 1) != -1) {
                    VerReport += 'ID ' + ID + ' - There can be only one Children Section in a Family Group.' + os.EOL;
                    verifyerr++;
                } else {
                    var ChBypnt2 = famgroup.indexOf("Children by ", CChpnt + 1);
                    if (ChBypnt2 != -1)
                        if (famgroup.substring(ChBypnt, famgroup.indexOf("\n", ChBypnt)) ==
                            famgroup.substring(ChBypnt2, famgroup.indexOf("\n", ChBypnt2))) {
                            VerReport += 'ID ' + ID + ' - There can be only one Children Section in a Family Group.' + os.EOL;
                            verifyerr++;
                        }
                }
                var WSDashEOL = famgroup.lastIndexOf(" -" + "\n", CChpnt);
                if (WSDashEOL == -1) {
                    VerReport += 'ID ' + ID + ' - The Citation Section must immediately precede the Children Section.' + os.EOL;
                    verifyerr++;
                } else
                    if (famgroup.substring(WSDashEOL - 6, WSDashEOL) != "Source" && famgroup.substring(WSDashEOL - 7, WSDashEOL) != "Sources" &&
                                  famgroup.substring(WSDashEOL - 8, WSDashEOL) != "Citation" &&
                                  famgroup.substring(WSDashEOL - 9, WSDashEOL) != "Citations") {
                        VerReport += 'ID ' + ID + ' - The Citation Section must immediately precede the Children Section.' + os.EOL;
                        verifyerr++;
                    }
                if (multipleCitations) {
                    /* since there are more than 1 Citations/Sources, each child needs to have at least 1 Citation reference */
                    x = famgroup.indexOf("\n", CChpnt) + 2;
                    while (x < famgroup.length) {
                        var childLine = famgroup.substring(x, famgroup.indexOf("\n", x));
                        if (childLine.indexOf("[") == -1 || childLine.indexOf("]") == -1) {
                            VerReport += 'ID ' + ID + " - The child line '" + childLine + "' needs to contain at least 1 Citation reference." +
                                         os.EOL;
                            verifyerr++;
                        }
                        x = famgroup.indexOf("\n", x) + 1;
                    }
                }
            }
        var ckSources = famgroup.indexOf("Sources -");
        var ckCitations = famgroup.indexOf("Citations -");
        var ckSource = famgroup.indexOf("Source -");
        var ckCitation = famgroup.indexOf("Citation -");
        var numberCS = 0, pntCS, workCS;
        if (ckSource != -1) {
            numberCS++;
            pntCS = ckSource;
        }
        if (ckSources != -1) {
            numberCS++;
            pntCS = ckSources;
        }
        if (ckCitation != -1) {
            numberCS++;
            pntCS = ckCitation;
        }
        if (ckCitations != -1) {
            numberCS++;
            pntCS = ckCitations;
        }
        if (!numberCS) {
            VerReport += 'ID ' + ID + ' - A Citation/Source Section is required. (Section heading must be one of:  ' +
                         '"Citation -", "Citations -", "Source -" or "Sources -".)' + os.EOL;
            verifyerr++;
        } else
            if (numberCS > 1) {
                VerReport += 'ID ' + ID + ' - More than 1 Citation/Source Section is present.' + os.EOL;
                verifyerr++;
            } else {
                pntCS = famgroup.indexOf("\n", pntCS) + 1;           // point to beginning of first Citation
                citeSection = famgroup.substring(pntCS, famgroup.indexOf("\n\n", pntCS));   // extract Citation Section
                if (famgroup[pntCS] >= '0' && famgroup[pntCS] <= '9') {
                    workCS = famgroup.substring(pntCS, famgroup.indexOf(" ", pntCS));
                    if (workCS.length > 1) {
                        for (x = 0; x < (workCS.length - 1); x++)
                            if (workCS[x] >= '0' && workCS[x] <= '9')
                                continue;
                            else {
                                multipleCitations = 0;
                                break;
                            }
                        if (x == (workCS.length - 1))
                            if (workCS[workCS.length] == '.')
                                multipleCitations = 1;         // more than 1 Citation
                            else
                                multipleCitations = 0;
                    } else
                        multipleCitations = 0;
                }
            }

        if (multipleCitations) {
            /* since there are more than 1 Citation/Source, all items in the Account Section need to have at least 1 Citation reference
               (Timeline done elsewhere) */
            var x = 0;

            while (x < famgroup.length)
                if (famgroup.substring(x, x + 7) == "Notes -" || famgroup.substring(x, x + 8) == "Extras -" ||
                               famgroup.substring(x, x + 14) == "Explanations -" || famgroup.substring(x, x + 11) == "Questions -")
                    break;
                else
                    x = famgroup.indexOf("\n\n", x) + 2;
            while (x < famgroup.length) {
                var entryItem = famgroup.substring(x, famgroup.indexOf("\n\n", x));
                if (entryItem == "Source -" || entryItem == "Sources -" || entryItem == "Citation -" || entryItem == "Citations -")
                    break;
                if (entryItem.indexOf("[") == -1 || entryItem.indexOf("]") == -1) {
                    VerReport += 'ID ' + ID + " - The Item '" + entryItem + "' needs to contain at least 1 Citation reference." + os.EOL;
                    verifyerr++;
                }
                x = famgroup.indexOf("\n\n", x) + 2;
            }
        }

        /* validate citation references */
        if (citeSection != "") {
            var citeCnt = 0, citeCntB, numErr;
            while (citeCnt < famgroup.length) {
                numErr = 0;
                citeCnt = famgroup.indexOf("[", citeCnt);
                if (citeCnt == -1) {
                    citeCnt = famgroup.length;
                    continue;
                } else {
                    citeCntB = famgroup.indexOf("]", citeCnt);
                    if (citeCntB == -1) {
                        VerReport += 'ID ' + ID + " - There is a '[' character without a corresponding ']' character. The '[]' characters are " +
                                     "used only to enclose Citation references." + os.EOL;
                        verifyerr++;
                        citeCnt++;
                        continue;
                    }
                    if (citeCntB == (citeCnt + 1)) {
                        VerReport += 'ID ' + ID + " - There is a ']' character immediately following a '[' character. The '[]' characters must " +
                                     "enclose a Citation reference." + os.EOL;
                        verifyerr++;
                        citeCnt++;
                        continue;
                    }
                    for (x = citeCnt + 1; x < citeCntB; x++)
                        if (famgroup[x] >= '0' && famgroup[x] <= '9')
                            continue;
                        else {
                            VerReport += 'ID ' + ID + " - A Citation reference contains non-numerics." + os.EOL;
                            verifyerr++;
                            x = citeCntB;
                            citeCnt++;
                            numErr = 1;
                            continue;
                        }
                    if (!numErr)
                        if (citeSection.indexOf(famgroup.substring(citeCnt + 1, citeCntB) + ".  ") == -1) {
                            VerReport += 'ID ' + ID + " - A Citation numbered '" + famgroup.substring(citeCnt + 1, citeCntB) + 
                                         "' (followed by a period and two spaces) does not exist." + os.EOL;
                            verifyerr++;
                            citeCnt++;
                            continue;
                        }
                    citeCnt = citeCntB;
                }
            }
        }

        /* validate Timeline Section */
        const searchResult = fuse.search('Timeline -');
        if (searchResult == "") {
            if (isw > 1)
                VerReport += 'ID ' + ID + ' - [info] No Timeline Section. (Timeline Section optional)' + os.EOL;
        } else {
            var cntsw = 0;
            var search4 = "";
            for (var key in searchResult) {
                if (searchResult[key].score == 0) {
                    search4 = searchResult[key].item;       /* always use an exact match over a near match */
                    if (isw > 1)
                        VerReport += 'ID ' + ID + ' - [info] Timeline Section header exact match.' + os.EOL;
                } else
                    if (searchResult[key].score < 0.5 && search4 == "") {
                        VerReport += 'ID ' + ID + ' - The Timeline Section header should be exactly "Timeline -".' + os.EOL;
                        verifyerr++;
                        search4 = searchResult[key].item;
                    }
                if (key > 0 && cntsw == 0) {
                    if (searchResult[key].score < 0.2) {
                        VerReport += 'ID ' + ID + ' - More than one Timeline Section header in Family Group.' + os.EOL;
                        verifyerr++;
                    } else
                        if (searchResult[key].score < 0.4)
                            VerReport += '[WARNING] ID ' + ID + ' - It looks like there is more than one Timeline Section header in ' +
                                         'Family Group.' + os.EOL;
                        else
                            if (searchResult[key].score < 0.5)
                                VerReport += '[attention] ID ' + ID + ' - There may be more than one Timeline Section header in Family Group.' +
                                             os.EOL;
                    cntsw = 1;
                }
            }

            if (search4 != "") {
                TL = famgroup.indexOf(search4);
                if (TL != -1) {
                    if (famgroup[TL - 1] == "\n" && famgroup[TL - 2] == "\n")
                        if (famgroup.substring(famgroup.lastIndexOf("\n", TL - 3) + 1, famgroup.lastIndexOf("\n", TL - 3) + 7) != "Mother") {
                            VerReport += 'ID ' + ID + ' - The Timeline Section must immediately follow the Head of Family section.' + os.EOL;
                            verifyerr++;
                        }
                    fgpos += ValidateTimelineSectionContents (ID, famgroup.substring(TL, famgroup.indexOf("\n\n", TL) + 1), isw);
                } else
                    misc.Logging("***** INTERNAL ERROR. No match on TL. Please report this to MELGenKey maintainer. *****");
            }
        }

        /* ensure all material pointed to exists */
        fgpos = 0;
        var BeginPath, Endfname;
        var DirRef = path.join(misc.ProcessDBSysInfo ("DBLocation"), "Reference");
        var DirImg = path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images");
        var DirUns = path.join(misc.ProcessDBSysInfo ("DBLocation"), "UnsureIfRelated");
        while (fgpos < famgroup.length) {
            pnt = famgroup.indexOf("->", fgpos);
            if (pnt == -1)
                /* no more pointers */
                break;
            if (famgroup.substring(pnt - 9, pnt) == "Reference") {
                for (Endfname = pnt + 2; Endfname < famgroup.length; Endfname++)
                    if (famgroup[Endfname] == " " || famgroup[Endfname] == "," || famgroup[Endfname] == ")" || famgroup[Endfname] == "\n")
                        break;
                if (Endfname >= famgroup.length) {
                    VerReport += 'ID ' + ID + " - It seems one of the 'Reference' pointers (->) in the Citation Section ends with something " +
                                 "other than a space, comma, right parenthesis, or end-of-line." + os.EOL;
                    verifyerr++;
                    fgpos = pnt + 2;
                    continue;
                }

                var fname = famgroup.substring(pnt + 2, Endfname);
                fname = fname.replaceAll('->', '/');
                fname = path.normalize(fname);
                if (!fs.existsSync(path.join(DirRef, fname))) {
                    VerReport += 'ID ' + ID + " - File '" + fname + "' does not exist within the 'Reference' directory/folder." + os.EOL;
                    verifyerr++;
                } else
                    if (isw > 1)
                        VerReport += 'ID ' + ID + " - [info] File '" + fname + "' found within the 'Reference' directory/folder." + os.EOL;
                fgpos = Endfname;
            } else {
                for (BeginPath = pnt; BeginPath > 0; BeginPath--)
                    if (famgroup[BeginPath] == " " || famgroup[BeginPath] == "(" || famgroup[BeginPath] == "\n")
                        break;
                if (!BeginPath) {
                    VerReport += 'ID ' + ID + " - It seems one of the pointers (->) is delimited at the beginning with something other " +
                                 "than a space, left parenthesis, or end-of-line." + os.EOL;
                    verifyerr++;
                    /* go to the end of the total pointer path so that the same pointer path is not errored more than once */
                    for (Endfname = pnt + 2; Endfname < famgroup.length; Endfname++)
                        if (famgroup[Endfname] == " " || famgroup[Endfname] == "," || famgroup[Endfname] == ")" || famgroup[Endfname] == "\n")
                            break;
                    fgpos = Endfname;
                    continue;
                }
                for (Endfname = pnt + 2; Endfname < famgroup.length; Endfname++)
                    if (famgroup[Endfname] == " " || famgroup[Endfname] == "," || famgroup[Endfname] == ")" || famgroup[Endfname] == "\n")
                        break;
                if (Endfname >= famgroup.length) {
                    VerReport += 'ID ' + ID + " - It seems one of the pointers (->) ends with something other " +
                                 "than a space, comma, right parenthesis, or end-of-line." + os.EOL;
                    verifyerr++;
                    fgpos = pnt + 2;
                    continue;
                }
                var wholepath = famgroup.substring(BeginPath + 1, Endfname), DirWhich, AbbrevWhich;
                wholepath = wholepath.replaceAll('->', '/');
                wholepath = path.normalize(wholepath);
                if (process.platform === "win32" && wholepath[wholepath.length - 1] === '.')
                    /* Windows doesn't allow a period as the last character in a filename */
                    wholepath = wholepath.substring(0, wholepath.length - 1);
                if (famgroup.substring(pnt - 15, pnt) == "UnsureIfRelated") {
                    DirWhich = DirUns;
                    AbbrevWhich = "UnsureIfRelated";
                    wholepath = wholepath.substring(wholepath.indexOf("/") + 1);
                } else {
                    DirWhich = DirImg;
                    AbbrevWhich = "Images";
                }
                if (!fs.existsSync(path.join(DirWhich, wholepath))) {
                    VerReport += 'ID ' + ID + " - File '" + wholepath + "' does not exist within the '" + AbbrevWhich + "' directory/folder." +
                                 os.EOL;
                    verifyerr++;
                } else
                    if (isw > 1)
                        VerReport += 'ID ' + ID + " - [info] File '" + wholepath + "' found within the '" + AbbrevWhich + "' directory/folder." +
                                     os.EOL;
                fgpos = Endfname;
            }
        }

        conseol = famgroup.indexOf("\n\n\n");
        if (famgroup[conseol + 3] != "\n") {       /* looking to see if at end of Family Group */
            VerReport += "ID " + ID + " - Two consecutive NULL lines not allowed (the only time more than 1 consecutive NULL line is allowed " +
                         "is 3 consecutive NULL lines to delineate the end of a Family Group)." + os.EOL;
            verifyerr++;
        }
    }

    /* ensure every file and directory within the Reference directory is actually referenced in the Family DataBase at least one time */

    if (1 == 1) {
        // Send update to ALL connected clients
        sseClients.forEach(client => {
            client.res.write("event: verify-progress-update\n");
            client.res.write(`data: ${JSON.stringify({ message: "CRCR" })}\n\n`);
        })
        await new Promise(resolve => setImmediate(resolve));
    }

    var DirRef = path.join(misc.ProcessDBSysInfo ("DBLocation"), "Reference");
    if (fs.existsSync(DirRef))
        fs.readdirSync(DirRef).forEach(file => {
            const Absolute = "Reference->" + file;
            var hit = familydata.indexOf(Absolute);
            if (hit == -1)
                /* the user should know about this even if they don't want to see info messages */
                VerReport += "[attention] The file '" + file + "' within the 'Reference' directory/folder is not referenced in the " +
                             "Family DataBase." + os.EOL;
            else
                if (isw > 1)
                    VerReport += "[info] The file '" + file + "' within the 'Reference' directory/folder is referenced in the Family DataBase." +
                                 os.EOL;
        })
    /* ensure every file and directory within the Images directory is actually referenced in the Family DataBase at least one time */
    if (fs.existsSync((path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images"))))
        traverseDir (path.join(misc.ProcessDBSysInfo ("DBLocation"), "Images"), isw);

    /* read the index file into famindex */

    if (1 == 1) {
        // Send update to ALL connected clients
        sseClients.forEach(client => {
            client.res.write("event: verify-progress-update\n");
            client.res.write(`data: ${JSON.stringify({ message: "DIDI" })}\n\n`);
        })
        await new Promise(resolve => setImmediate(resolve));
    }

    var rIndex = misc.ReadIndex ();
    if (rIndex != 1)
        VerReport += "An index file does not exist. No verification done on index." + os.EOL + os.EOL;
    else {
        /* verify index associated with Family Data */
        VerReport += os.EOL + "In the index:" + os.EOL;

        /* combine any entries which use multiple lines into one line (won't sort properly otherwise) */
        var indexPnt = 0, line, wsCnt, tPnt, IIndex = '', combinesw = 0, iChgsw = 0, nulllines = 0, iOKsw = 1;
        while (indexPnt < famindex.length) {
            line = '';
            wsCnt = 0;
            tPnt = 0;
            while (1) {
                line += famindex.substring (indexPnt + tPnt, famindex.indexOf("\n", indexPnt + tPnt));
                if (line == '') {
                    /* remove null lines from index */
                    indexac++;
                    nulllines++;
                    iChgsw = 1;
                    indexPnt++;
                    break;
                }
                if (line[line.length - 1] == ',') {
                    /* combine lines */
                    line += " ";
                    tPnt = line.length;
                    while (famindex[indexPnt + tPnt] == ' ') {
                        wsCnt++;
                        tPnt++;
                    }
                    combinesw++;
                    indexac++;
                    iChgsw = 1;
                } else {
                    IIndex += line + "\n";
                    indexPnt += line.length + wsCnt + 1;
                    break;
                }
            }
        }
        famindex = IIndex;

        /* verify beginning of each line in index is of the format "surname,bfirstnamebmiddlenamebb" */
        indexPnt = 0;
        IIndex = ''
        while (indexPnt < famindex.length) {
            line = famindex.substring (indexPnt, famindex.indexOf("\n", indexPnt));
            indexlc++;
            tPnt = line.indexOf(',');
            if (tPnt == -1) {
                VerReport += 'Line "' + line + '" does not contain a comma to indicate the end of the LastName.' + os.EOL;
                indexPnt += line.length + 1;
                IIndex += line + "\n";
                verifyerr++;
                iOKsw = 0;
                continue;
            }
            if (line[tPnt + 1] != ' ') {
                VerReport += '[notice] Added whitespace (blank) immediately after comma in line "' + line + '".' + os.EOL;
                iChgsw = 1;
                indexac++;
                line = line.substring(0, tPnt + 1) + ' ' + line.substring(tPnt + 1);
            }
            var tHold = line.substring(0, tPnt);
            var tHoldPnt = tPnt + 2;
            if (tHold.match(/[^-'\sa-zA-Z]/)) {
                VerReport += 'The LastName in "' + line + '" contains a character other than hyphen, apostrophy, space or alpha.' + os.EOL;
                indexPnt += line.length + 1;
                IIndex += line + "\n";
                verifyerr++;
                iOKsw = 0;
                continue;
            }
            if (!tHold.match(/[A-Z]/)) {
                VerReport += 'The LastName in "' + line + '" does not contain at least one upper case letter.' + os.EOL;
                indexPnt += line.length + 1;
                IIndex += line + "\n";
                verifyerr++;
                iOKsw = 0;
                continue;
            }
            tPnt = line.indexOf('  ');
            if (tPnt == -1) {
                VerReport += 'Line "' + line + '" does not contain 2 consecutive whitespaces (blanks) to indicate the end of the entire name.' +
                             os.EOL;
                indexPnt += line.length + 1;
                IIndex += line + "\n";
                verifyerr++;
                iOKsw = 0;
                continue;
            }
            tHold = line.substring(tHoldPnt, tPnt);
            if (tHold != "------") {
                var tSpPnt = tHold.indexOf(' ');
                var t2Hold = '';
                if (tSpPnt != -1) {
                    var t1Hold = tHold.substring(0, tSpPnt);
                    t2Hold = tHold.substring(tSpPnt + 1);
                } else
                    var t1Hold = tHold;

                if (t1Hold.match(/[^-'.\sa-zA-Z]/)) {
                    VerReport += 'The FirstName in "' + line + '" contains a character other than hyphen, apostrophy, period, space ' +
                                 'or alpha.' + os.EOL;
                    indexPnt += line.length + 1;
                    IIndex += line + "\n";
                    verifyerr++;
                    iOKsw = 0;
                    continue;
                }
                if (!t1Hold.match(/[A-Z]/)) {
                    VerReport += 'The FirstName in "' + line + '" does not contain at least one upper case letter.' + os.EOL;
                    indexPnt += line.length + 1;
                    IIndex += line + "\n";
                    verifyerr++;
                    iOKsw = 0;
                    continue;
                }
                if (t2Hold != '') {
                    if (t2Hold.match(/[^-'.\sa-zA-Z]/)) {
                        VerReport += 'The MiddleName in "' + line + '" contains a character other than hyphen, apostrophy, period, ' +
                                     'space or alpha.' + os.EOL;
                        indexPnt += line.length + 1;
                        IIndex += line + "\n";
                        verifyerr++;
                        iOKsw = 0;
                        continue;
                    }
                    if (!t2Hold.match(/[A-Z]/)) {
                        VerReport += 'The MiddleName in "' + line + '" does not contain at least one upper case letter.' + os.EOL;
                        indexPnt += line.length + 1;
                        IIndex += line + "\n";
                        verifyerr++;
                        iOKsw = 0;
                        continue;
                    }
                }
            }
            IIndex += line + "\n";
            indexPnt += line.length + 1;
        }
        famindex = IIndex;

        /* if no errors, sort references in each line of index, and total lines in index */
        if (iOKsw) {
            var i, j, tpa1, tpb1, tpa2, tpb2, tpa3, tpb3, tpa4, tpb4, a1, a2, a3, a4, a5, b1, b2, b3, b4, b5, swapped,
                a5spl = [], b5spl = [], sortsw = 0, refs, iLength, refsspl = [], refsspl2 = [];

            /* verify sequence of references in each index entry */
            indexPnt = 0;
            IIndex = ''
            var k;
            sseMainLoopCounter = 0;
            while (indexPnt < famindex.length) {
                sseMainLoopCounter++;
                if (sseMainLoopCounter % 100 === 0) {
                    const progressPercentage = Math.trunc((indexPnt / famindex.length) * 100);

                    // Send update to ALL connected clients
                    sseClients.forEach(client => {
                        client.res.write("event: verify-progress-update\n");
                        client.res.write(`data: ${JSON.stringify({ message: "SR" + progressPercentage })}\n\n`);
                    })
                    await new Promise(resolve => setImmediate(resolve));
                }

                refsspl.length = 0;
                refsspl2.length = 0;
                line = famindex.substring (indexPnt, famindex.indexOf("\n", indexPnt));
                tPnt = line.indexOf('  ') + 2;
                refs = line.substring(tPnt);
                for (j = i = 0; i < refs.length; i++)
                    if (refs[i] == ',' || refs[i] == ' ')
                        continue;
                    else {
                        k = refs.indexOf(',', i);
                        if (k == -1) {
                            refsspl[j] = refs.substring(i);
                            break;
                        } else {
                            refsspl[j] = refs.substring(i, k);
                            i = k;
                            j++;
                        }
                    }
                iLength = refsspl.length;
                if (iLength > 1) {
                    for (k = 0; k < iLength; k++)
                        refsspl2[k] = refsspl[k].split(".");
                    /* sort refs */
                    for (i = 0; i < refsspl2.length - 1; i++) {
                        swapped = false;

                        for (j = 0; j < refsspl2.length - 1; j++) {
                            if (Number(refsspl2[j][0]) > Number(refsspl2[j + 1][0])) {
                                [refsspl[j], refsspl[j + 1]] = [refsspl[j + 1], refsspl[j]];
                                swapped = true;
                            }
                            if (Number(refsspl2[j][0]) == Number(refsspl2[j + 1][0])) {
                                if (Number(refsspl2[j][1]) > Number(refsspl2[j + 1][1])) {
                                    [refsspl[j], refsspl[j + 1]] = [refsspl[j + 1], refsspl[j]];
                                    swapped = true;
                                }
                            }
                        }
                        if (swapped == false)
                            break;
                        else {
                            indexac++;
                            sortsw = 1;
                        }
                    }
                }
                indexPnt += line.length + 1;
                /* verify that each ref (Family group) actually exists, and verify that the name appears in that Family Group
                   take into account the disable-check option */
                if (line.indexOf("------") == -1)
                    for (i = 0; i < iLength; i++)
                        if (Number(refsspl[i].substring(0, refsspl[i].indexOf("."))) >= Number(disable)) {
                            var fdPnt = familydata.indexOf("\n\n" + refsspl[i] + "  ");
                            if (fdPnt == -1) {
                                VerReport += "Family Group '" + refsspl[i] + "' does not exist in Family DataBase as referenced in the " +
                                             "index, line: '" + line + "'." + os.EOL;
                                verifyerr++;
                                iOKsw = 0;
                            } else {
                                if ((familydata.indexOf("\n\n\n"), fdPnt + 3) == -1)
                                    var fgroup = familydata.substring(fdPnt + 3);                // last Family Group in Family DataBase
                                else
                                    var fgroup = familydata.substring(fdPnt + 3, familydata.indexOf("\n\n\n", fdPnt + 3));
                                var sname = line.substring(0, line.indexOf(", "));
                                var oname = line.substring(line.indexOf(", ") + 2, line.indexOf("  "));
                                var nPnt = fgroup.indexOf(oname + ' ' + sname);
                                if (nPnt == -1) {
                                    /* look only for the given names in the Children Section */
                                    var childrenPnt = fgroup.indexOf("Children");
                                    /* every Family Group will have a valid Children Section at this point */
                                    var chPnt = fgroup.indexOf(oname, childrenPnt);
                                    if (chPnt == -1)
                                        if (autodel == "1") {
                                            /* remove refs where the name is not found; if no refs remaining, null entire line */
                                            line = line.replace(", " + refsspl[i], "");     // sequence
                                            line = line.replace("," + refsspl[i], "");      //          is
                                            line = line.replace(refsspl[i] + ", ", "");     //             significant
                                            line = line.replace(refsspl[i] + ",", "");      //                         here
                                            line = line.replace(refsspl[i], "");            //                              & here
                                            refsdel++;
                                            if (line.search(/\d/) == -1) {
                                                /* no references remaining in line */
                                                line = "";
                                                ilinesdel++
                                            }
                                        } else {
                                            VerReport += "The name '" + oname + ' ' + sname + "' does not appear in Family Group '" + refsspl[i] +
                                                         "' as referenced in the index, line: '" + line + "'." + os.EOL;
                                            verifyerr++;
                                            iOKsw = 0;
                                        }
                                }
                            }
                        }
                if (line != "")
                    IIndex += line + "\n";
            }

            famindex = IIndex;
            const iLines = famindex.split("\n");
            iLength = iLines.length;
            nindexlc = iLength - 1;

            /* sort index entries by (1) LastName (2) FirstName (3) MiddleName (4) AdditionalNames (5) last reference */
            sseMainLoopCounter = 0;
            for (i = 0; i < iLength - 1; i++) {

                sseMainLoopCounter++;
                if (sseMainLoopCounter % 10 === 0) {
                    const progressPercentage = Math.trunc((i / (iLength - 1)) * 100);

                    // Send update to ALL connected clients
                    sseClients.forEach(client => {
                        client.res.write("event: verify-progress-update\n");
                        client.res.write(`data: ${JSON.stringify({ message: "SI" + progressPercentage })}\n\n`);
                    })
                    await new Promise(resolve => setImmediate(resolve));
                }

                swapped = false;
                for (j = 0; j < iLength - 1; j++) {
                    a5spl.length = 0;
                    b5spl.length = 0;
                    a1 = iLines[j].substring(0, iLines[j].indexOf(','));
                    b1 = iLines[j + 1].substring(0, iLines[j + 1].indexOf(','));
                    /* remove any whitespaces from surnames; this ensures the correct sort order for, e.g., "Van Smith" and "VanSmith" */
                    a1 = a1.replace(/\s+/g, "");
                    b1 = b1.replace(/\s+/g, "");
                    tpa1 = iLines[j].indexOf(', ') + 2;
                    tpb1 = iLines[j + 1].indexOf(', ') + 2;
                    a2 = iLines[j].substring(tpa1, iLines[j].indexOf(' ', tpa1));
                    b2 = iLines[j + 1].substring(tpb1, iLines[j + 1].indexOf(' ', tpb1));
                    /* unknown first names should sort at the end of the surname block */
                    if (a2 == "------")
                        a2 = 'zzzzzz';
                    if (b2 == "------")
                        b2 = 'zzzzzz';
                    tpa2 = iLines[j].indexOf(' ', tpa1);
                    tpb2 = iLines[j + 1].indexOf(' ', tpb1);
                    if (iLines[j][tpa2 + 1] == ' ') {
                        a3 = '';
                        tpa3 = tpa2 + 2;
                    } else {
                        a3 = iLines[j].substring(tpa2 + 1, iLines[j].indexOf(' ', tpa2 + 1));
                        tpa3 = iLines[j].indexOf(' ', tpa2 + 1);
                    }
                    if (iLines[j + 1][tpb2 + 1] == ' ') {
                        b3 = '';
                        tpb3 = tpb2 + 2;
                    } else {
                        b3 = iLines[j + 1].substring(tpb2 + 1, iLines[j + 1].indexOf(' ', tpb2 + 1));
                        tpb3 = iLines[j + 1].indexOf(' ', tpb2 + 1);
                    }
                    if (iLines[j][tpa3 + 1] == ' ')
                        a4 = '';
                    else
                        a4 = iLines[j].substring(tpa3 + 1, iLines[j].indexOf('  ', tpa3 + 1));
                    if (iLines[j + 1][tpb3 + 1] == ' ')
                        b4 = '';
                    else
                        b4 = iLines[j + 1].substring(tpb3 + 1, iLines[j + 1].indexOf('  ', tpb3 + 1));
                    tpa4 = iLines[j].lastIndexOf(' ');
                    a5 = iLines[j].substring(tpa4)
                    a5spl = a5.split('.');
                    tpb4 = iLines[j + 1].lastIndexOf(' ');
                    b5 = iLines[j + 1].substring(tpb4)
                    b5spl = b5.split('.');

                    if (a1.toLowerCase() > b1.toLowerCase() && b1 != '') {
                        [iLines[j], iLines[j + 1]] = [iLines[j + 1], iLines[j]];
                        swapped = true;
                    }
                    if (a1.toLowerCase() == b1.toLowerCase()) {
                        if (a2.toLowerCase() > b2.toLowerCase()) {
                            [iLines[j], iLines[j + 1]] = [iLines[j + 1], iLines[j]];
                            swapped = true;
                        }
                        if (a2.toLowerCase() == b2.toLowerCase()) {
                            if (a3.toLowerCase() > b3.toLowerCase()) {
                                [iLines[j], iLines[j + 1]] = [iLines[j + 1], iLines[j]];
                                swapped = true;
                            }
                            if (a3.toLowerCase() == b3.toLowerCase()) {
                                if (a4.toLowerCase() > b4.toLowerCase()) {
                                    [iLines[j], iLines[j + 1]] = [iLines[j + 1], iLines[j]];
                                    swapped = true;
                                }
                                if (a4.toLowerCase() == b4.toLowerCase()) {
                                    if (a5spl[0] > b5spl[0]) {
                                        [iLines[j], iLines[j + 1]] = [iLines[j + 1], iLines[j]];
                                        swapped = true;
                                    }
                                    if (a5spl[0] == b5spl[0]) {
                                        if (a5spl[1] > b5spl[1]) {
                                            [iLines[j], iLines[j + 1]] = [iLines[j + 1], iLines[j]];
                                            swapped = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if (swapped == false)
                    break;
                else {
                    indexac++;
                    sortsw = 1;
                }
            }
            if (sortsw)
                famindex = iLines.join("\n");

            if (sortsw && !verifyerr) {
                VerReport += '[notice] Index sorted.' + os.EOL;
                iChgsw = 1;
            }
        } else
            verifyerr++;        // index failed verification

        /* if no errors and index changed, copy old index to index.ORIG[seq#]; save new index */
        if (iOKsw)
            if (iChgsw) {
                if (combinesw) {
                    VerReport += combinesw + " continuation line"
                    if (combinesw > 1)
                        VerReport += 's';
                    VerReport += " for entries in index combined into 1 line." + os.EOL;
                }
                if (nulllines) {
                    VerReport += "Removed " + nulllines + " null line";
                    if (nulllines > 1)
                        VerReport += 's';
                    VerReport += " from index." + os.EOL;
                }

                var contents = '';
                var Dir = path.join(misc.ProcessDBSysInfo ("DBLocation"), "PlainText");
                contents = fs.readdirSync(Dir);
                if (contents !== '') {
                    var cntd = 0;
                    contents.forEach(file => {
                        if (file.indexOf('index.ORIG') !== -1)
                            cntd++;
                    })
                    try {
                        fs.renameSync(path.join(Dir, "index"), path.join(Dir, "index.ORIG") + cntd);
                        misc.Logging ('Moved "' + Dir + "/index" + '" to "' + Dir + "/index.ORIG" + cntd + '".');
                        VerReport += "Backed up index file." + os.EOL;
                    }
                    catch (err) {
                        misc.Logging(err + "; problem moving '" + Dir + "/index" + '" to ' + Dir + "/index.ORIG" + cntd + '.');
                    }
                }
                /* write new index file */
                try {
                    fs.writeFileSync(path.join(Dir, "index"), famindex);
                    misc.Logging("Created a new 'index' file.");
                    VerReport += "Created a new index file." + os.EOL;
                }
                catch (err) {
                    misc.Logging(err + "; problem writing '" + Dir + "/index" + "'.");
                }

                VerReport += "Number of entries in old index - " + indexlc + '.' + os.EOL;
                VerReport += "Number of autocorrections while processing the final index - " + indexac + '.' + os.EOL;
                VerReport += "Number of references deleted - " + refsdel + ', number of entries (lines) deleted - ' + ilinesdel + "." + os.EOL;
                VerReport += "Number of entries in newly created index - " + nindexlc + '.' + os.EOL;
            } else
                VerReport += os.EOL + "No errors in the index file and no changes." + os.EOL + os.EOL;
    }

    var dbStatusNow;
    if (verifyerr) {
        VerReport += os.EOL + verifyerr + " fatal error";
        if (verifyerr > 1)
            VerReport += "s." + os.EOL;
        else
            VerReport += "." + os.EOL;
        VerReport += os.EOL + "Verification unsuccessful." + os.EOL;
        misc.Logging("Active Family DataBase failed verification.");
        dbStatusNow = misc.ProcessDBSysInfo ("DBStatus");    /* get DBStatus of active Family DataBase */
        if (dbStatusNow != 4) {
            misc.UpdateDBSysInfo ("DBStatus", 4);     /* update DBStatus for active Family DataBase to 4 (failed verification) */
            try {
                /* write MELGenKeyInfo.txt */
                fs.writeFileSync('MELGenKeyInfo.txt', DBSysInfo);
                misc.Logging("Change in active DB status to unverified, MELGenKeyInfo.txt written.");
            }
            catch (err) {
                misc.Logging(err + "; problem writing 'MELGenKeyInfo.txt'.");
            }
        }
    } else {
        VerReport += os.EOL + "No fatal errors." + os.EOL;
        VerReport += os.EOL + os.EOL + "Verification successful." + os.EOL + "Processed " + fgcnt + " Family Group";
        if (fgcnt != 1)
            VerReport += "s";
        VerReport += ", " + linecnt + " lines of data, " + fdpos + " characters." + os.EOL;
        misc.Logging("Verification of active Family DataBase successful.");

        dbStatusNow = misc.ProcessDBSysInfo ("DBStatus");    /* get DBStatus of active Family DataBase */
        if (dbStatusNow == 1 || dbStatusNow == 3) {
            /* do nothing */
        } else {
            if (dbStatusNow == 2)
                misc.UpdateDBSysInfo ("DBStatus", 3);     /* update DBStatus for active Family DataBase to 3 (data modified, verified) */
            else
                misc.UpdateDBSysInfo ("DBStatus", 1);     /* update DBStatus for active Family DataBase to 1 (verified) */
            try {
                /* write MELGenKeyInfo.txt */
                fs.writeFileSync('MELGenKeyInfo.txt', DBSysInfo);
                misc.Logging("Change in active DB status to verified, MELGenKeyInfo.txt written.");
            }
            catch (err) {
                misc.Logging(err + "; problem writing 'MELGenKeyInfo.txt'.");
            }
        }
    }

    VerReport += os.EOL + "End of Verify Report" + os.EOL;
    VerReport += "</pre> <script type=\"text/javascript\" src=\"clib.js\"></script> <button id='printPB' " +
                 "onclick='userPrint(\"Verify\")'>Print Verify Report</button> </body> </html>";
    return VerReport;
}

/* go through directory recursively getting the full path to each file */
function traverseDir(dir, isw) {
    fs.readdirSync(dir).forEach(file => {
        /* skip the UnsureIfRelated directory and the tableofcontents file */
        if (file != "UnsureIfRelated" && file != "tableofcontents") {
            let fullPath = path.join(dir, file);
            if (fs.lstatSync(fullPath).isDirectory())
                traverseDir(fullPath, isw);
            else {
                /* we have a file */
                fullPath = fullPath.substring(fullPath.indexOf("Images") + 7);
                fullPath = fullPath.replaceAll("/", "->");
                fullPath = fullPath.replaceAll("\\", "->");
                if (familydata.indexOf(fullPath) == -1) {
                    /* if an index.html file exists in directory, assume the Citation is the directory rather than the file itself */
                    if (!fs.existsSync(path.join(dir, 'index.html')))
                        /* show user this even if he/she doesn't want to see info messages */
                        VerReport += "[attention] The file '" + fullPath + "' within the 'Images' directory/folder is NOT referenced in the " +
                                     "Family DataBase." + os.EOL;
                } else
                    if (isw > 1)
                        VerReport += "[info] The file '" + fullPath + "' within the 'Images' directory/folder is referenced in the Family " +
                                     "DataBase." + os.EOL;
            }
        }
    })
}

function ValidateTimelineSectionContents (ID, TL, isw) {
    var TLpnt, TLevent, prevdate = -1;

    TLpnt = 0;
    while (1) {
        TLpnt = TL.indexOf("\n", TLpnt) + 1;                 /* point to beginning of next Timeline event */
        if (TLpnt >= TL.length)
            /* end of Timeline Section */
            break;
        TLevent = TL.substring(TLpnt, TL.indexOf("\n", TLpnt));    /* get next Timeline event */
        /* validate date */
        if (TLevent.substring(0,12) == "            ") {
            if (prevdate == -1) {
                VerReport += 'ID ' + ID + ' - First entry in Timeline Section must contain a date.' + os.EOL;
                verifyerr++;
            }
        } else {
            if (prevdate == TLevent.substring(0,12) && (prevdate[11] != "-" || TLevent[11] != "-"))
                if (isw > 1)
                    VerReport += 'ID ' + ID + ' - [info] Two consecutive event dates (' + TLevent.substring(0, 12) + ') in Timeline Section are ' +
                                 'exactly the same.' + os.EOL;
            /* validate date */
            if ((isNaN(TLevent[0]) && TLevent[0] != " ") || (isNaN(TLevent[1]) && TLevent[1] != " ") || TLevent[2] != " " || 
                                        ("   JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(TLevent.substring(3,6))) == -1 ||
                                        (" cCd<>-".indexOf(TLevent[6])) == -1 || isNaN(TLevent.substring(7,11))) {
                VerReport += 'ID ' + ID + " - The date field (columns 1-11) in the Timeline Section event dated '" + TLevent.substring(0,11) +
                             "' is not valid. (See 'Help/Info/Docs -&gt; Data Format and Notes'.)" + os.EOL;
                verifyerr++;
            }
            if (prevdate != -1) {
                /* take into account "double date" */
                if (prevdate[6] == 'd')
                    var prevAdd1 = 1;
                else
                    var prevAdd1 = 0;
                if (TLevent[6] == 'd')
                    var TLAdd1 = 1;
                else
                    var TLAdd1 = 0;
                if (((Number(TLevent.substring(7,11)) + TLAdd1) < (Number(prevdate.substring(7,11)) + prevAdd1)) ||
                                  ((TLevent.substring(7,11) + TLAdd1) == (prevdate.substring(7,11) + prevAdd1) &&
                                   ("JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(TLevent.substring(3,6)) / 3) <
                                   ("JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(prevdate.substring(3,6)) / 3) &&
                                   TLevent.substring(3,6) != "   " && prevdate.substring(3,6) != "   ") ||
                                  ((TLevent.substring(7,11) + TLAdd1) == (prevdate.substring(7,11) + prevAdd1) &&
                                   ("JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(TLevent.substring(3,6)) / 3) ==
                                   ("JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(prevdate.substring(3,6)) / 3) &&
                                   TLevent.substring(3,6) != "   " && prevdate.substring(3,6) != "   " &&
                                   Number(TLevent.substring(0,2)) < Number(prevdate.substring(0,2)) &&
                                   TLevent.substring(0,2) != "  " && prevdate.substring(0,2) != "  "))
                    if (TLevent[11] != "-" && prevdate[11] != "-") {
                        VerReport += 'ID ' + ID + " - The date field (columns 1-11) in the event dated '" + TLevent.substring(0,11) +
                                     "' in the Timeline Section is less than the date in the previous event." + os.EOL;
                        verifyerr++;
                    }
            }
            prevdate = TLevent.substring(0,12);
        }
        if (TLevent.substring(0,15) == "               ")
            if (isw > 1)
                VerReport += 'ID ' + ID + ' - [info] Contains a continuation line.' + os.EOL;
        if (TLevent[11] != " " && TLevent[11] != "-") {
            VerReport += 'ID ' + ID + ' - Column 12 must contain either a whitespace (blank) or a dash.' + os.EOL;
            verifyerr++;
        }
        if (multipleCitations)
            /* since there are more than 1 Citation/Source, each Timeline event needs to have at least 1 Citation reference */
            if (TLevent.indexOf("[") == -1 || TLevent.indexOf("]") == -1) {
                VerReport += 'ID ' + ID + " - The Timeline event dated '" + TLevent.substring(0,11) +
                             "' needs to contain at least 1 Citation reference." + os.EOL;
                verifyerr++;
            }
    }
    return TL.length;
}

module.exports = { Verify };

