const misc = require ("./misc.js");
const os = require("os");

async function Search (postdata) {
    var rDB = 0, Swarnings = '', Serrors = '', Sdata = '';
    /* searching the Family DataBases will be done here; searching sites on the Web will be done in the HTML module */

    /* read family data */
    if (postdata.hasOwnProperty('ActiveDB'))
        rDB = misc.ReadFamilyDB ();
    if (!rDB && postdata.hasOwnProperty('ActiveDB'))
        Swarnings += "There are no family files for the active Family DataBase." + os.EOL + os.EOL;
    if (rDB == -2 && postdata.hasOwnProperty('ActiveDB'))
        Swarnings += "The Family DataBase is larger than 200MB and cannot be processed." + os.EOL + os.EOL;

    if (!postdata.hasOwnProperty('ActiveDB') && !postdata.hasOwnProperty('Web') && !postdata.hasOwnProperty('IndSites'))
        Serrors += "No search area specified. Check at least one of the areas to search (Active DB,<br>" +
                   "Entire Web and/or Individual Web Sites at the top of the form and re-submit the form.<br><br>";

    if (postdata.firstname == '' && postdata.middlename == '' && postdata.lastname == '')
        Serrors += "No name specified to search. Enter something for the name of the person for whom you are<br>" +
                   "searching near the top of the form and re-submit the form.<br><br>";

    if (Serrors != "") {
        Serrors = "ERRORS " + Serrors;
        return Serrors;
    }

    Sdata += "<!doctype html> <html> <body id='Body'> <style type='text/css'> @media print { @page { margin-left: ";
    Sdata += "0.5in; margin-right: 0.5in; margin-top: 0; margin-bottom: 0; } #printPB { display: none; } } </style> <pre>";
    Sdata += os.EOL + "MELGenUtils" + os.EOL + "Looking for:" + os.EOL;
    if (postdata.firstname != '')
        Sdata += "First Name of '" + postdata.firstname + "'" + os.EOL;
    if (postdata.middlename != '')
        Sdata += "Middle Name of '" + postdata.middlename + "'" + os.EOL;
    if (postdata.lastname != '')
        Sdata += "Last Name of '" + postdata.lastname + "'" + os.EOL;
    if (postdata.year != '')
        Sdata += "Year '" + postdata.year + "'" + os.EOL;
    if (postdata.hasOwnProperty('ActiveDB'))
        Sdata += "in the active DataBase (" + misc.ProcessDBSysInfo("DBName") + ")" + os.EOL + os.EOL;
    if (postdata.hasOwnProperty('SCit'))
        Sdata += "Not searching in Citation/Source sections in the active DataBase" + os.EOL + os.EOL;
    Sdata += os.EOL + "Search Results" + os.EOL + os.EOL + os.EOL;
    Sdata += Swarnings;

    if (postdata.hasOwnProperty('ActiveDB') && familydata != '') {
        var cnt, cntmatches, find, fmn, fln, gotamatch;

        /* need to check for each name (first, middle & last) individually in case there is a line break between any two of the names */
        for (cnt = gotamatch = cntmatches = 0; cnt < familydata.length; cnt++, gotamatch = 0) {
            if (Sdata.length > 200000000) {
                Sdata += os.EOL + os.EOL + "Search Report reached maximum size (greater than 200MB). Report terminated. " +
                         "There could be more matches." + os.EOL + os.EOL;
                break;
            }
            if (postdata.firstname != '' && postdata.middlename != '' && postdata.lastname != '') {
                /* looking for firstname, middlename & lastname */
                find = familydata.indexOf (postdata.firstname, cnt);
                if (find == -1) {
                    /* search finished */
                    break;
                }
                if (postdata.hasOwnProperty('SCit')) {
                    /* don't look in the Citation/Sources Section for matches */
                    if (misc.DetermineSection (find) == "Citations") {
                        cnt = find;
                        continue;
                    }
                }
                /* check if match is in Children section */
                childsec = 0;
                if (misc.DetermineSection (find) == "Children")
                    childsec = 1;
                /* go to the next word & match on middlename; if a match & not in Children section, go to the following word & match on lastname */
                for (fmn = find; fmn < familydata.length; fmn++) {
                    if (familydata[fmn] == ' ' || familydata[fmn] == "\n") {
                        fmn++;
                        if (postdata.middlename == familydata.substring (fmn, fmn + postdata.middlename.length)) {
                            if (!childsec) {
                                for (fln = fmn; fln < familydata.length; fln++) {
                                    if (familydata[fln] == ' ' || familydata[fln] == "\n") {
                                        fln++;
                                        if (postdata.lastname == familydata.substring (fln, fln + postdata.lastname.length)) {
                                            /* matched on name; look for match on year if present */
                                            if (misc.Look4Match (postdata, find, fln + postdata.lastname.length))    /* 1st, mid & last names */
                                                gotamatch = 1;
                                            fmn = familydata.length;
                                            break;
                                        }
                                        else {
                                            fmn = familydata.length;
                                            break;
                                        }
                                    }
                                }
                            }
                            else {
                                gotamatch = 1;     /* firstname & middlename match in Children section; still need to match on lastname */
                                break;
                            }
                        }
                        else {
                            break;
                        }
                    }
                }
                if (childsec && gotamatch) {
                    /* a match in the Children section */
                    gotamatch = misc.ChildrenMatch (find, postdata, fmn + postdata.middlename.length);
                    if (gotamatch == -1) {
                        cnt = find;
                        continue;
                    }
                }
            }

            if (postdata.firstname != '' && postdata.middlename != '' && postdata.lastname == '') {
                /* looking for firstname & middlename */
                var twoEOL, childsec;

                find = familydata.indexOf (postdata.firstname, cnt);
                if (find == -1) {
                    /* search finished */
                    break;
                }
                if (postdata.hasOwnProperty('SCit')) {
                    /* don't look in the Citation/Sources Section for matches */
                    if (misc.DetermineSection (find) == "Citations") {
                        cnt = find;
                        continue;
                    }
                }
                /* check if match is in Children section */
                childsec = 0;
                if (misc.DetermineSection (find) == "Children")
                    childsec = 1;
                /* firstname should NOT be preceded by some semblance of a name */
                if (familydata[find - 1] == ' ' || familydata[find - 1] == "\n") {
                    var pns = [".", ",", ":", "!", "?", " ", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

                    if (pns.indexOf (familydata[find - 2]) > -1) {
                        ;            /* do nothing */
                    }
                    else {
                        for (tf = find - 2; tf >= 0; tf--) {
                            if (familydata[tf] == "\n" || familydata[tf] == ' ') {
                                if ((familydata[tf + 1] >= 'A' && familydata[tf + 1] <= 'Z') || familydata.substring(tf + 1, tf + 7) == "------") {
                                    cnt = find;
                                    break;
                                }
                                else {
                                    break;
                                }
                            }
                        }
                        if (tf == 0 || cnt == find) {
                            cnt = find;   /* keep this in case tf == 0 */
                            continue;
                        }
                    }
                }
                else {
                    cnt = find;
                    continue;
                }
                /* go to the next word & match on middlename; if a match & NOT in Children section, check the following word for
                   some semblance of a name */
                for (fmn = find; fmn < familydata.length; fmn++) {
                    if (familydata[fmn] == ' ' || familydata[fmn] == "\n") {
                        fmn++;
                        if (postdata.middlename == familydata.substring (fmn, fmn + postdata.middlename.length)) {
                            if (!childsec) {
                                var tf;

                                tf = fmn + postdata.middlename.length;
                                if (familydata[tf] == ' ' || familydata[tf] == "\n") {
                                    if (((familydata[tf + 1] >= 'A' && familydata[tf + 1] <= 'Z') ||
                                                    familydata.substring(tf + 1, tf + 7) == "------") &&
                                                    (familydata.substring(tf + 1, tf + 7) != "County" &&
                                                     familydata.substring(tf + 1, tf + 9) != "Township" &&
                                                     familydata.substring(tf + 1, tf + 10) != "Father - " &&
                                                     familydata.substring(tf + 1, tf + 10) != "Mother - ")) {
                                        /* matched on name; look for match on any other factors which are present */
                                        if (misc.Look4Match (postdata, find, tf))                 /* 1st & mid names */
                                            gotamatch = 1;
                                        break;
                                    }
                                    else {
                                        break;
                                    }
                                }
                                else {
                                    break;
                                }
                            }
                            else {
                                /* matched on name; look for match on any other factors which are present */
                                if (misc.Look4Match (postdata, find, fmn + postdata.middlename.length))              /* 1st & mid names */
                                    gotamatch = 1;
                                break;
                            }
                        }
                        else {
                            break;
                        }
                    }
                }
            }

            if (postdata.firstname != '' && postdata.middlename == '' && postdata.lastname != '') {
                /* looking for firstname & lastname */
                var childsec, twoEOL, tf;

                find = familydata.indexOf (postdata.firstname, cnt);
                if (find == -1) {
                    /* search finished */
                    break;
                }
                if (postdata.hasOwnProperty('SCit')) {
                    /* don't look in the Citation/Sources Section for matches */
                    if (misc.DetermineSection (find) == "Citations") {
                        cnt = find;
                        continue;
                    }
                }
                /* check if match is in Children section */
                childsec = 0;
                if (misc.DetermineSection (find) == "Children") {
                    childsec = 1;

                    /* match is in Children section; additional checks are different than for matches in other sections */
                    if (familydata[find - 1] == ' ' && familydata[find - 2] == ' ') {
                        ;    /* do nothing, still need to match on lastname */
                    }
                    else {
                        cnt = find;
                        continue;
                    }
                }

                /* firstname should NOT be preceded by some semblance of a name */
                if (familydata[find - 1] == ' ' || familydata[find - 1] == "\n") {
                    var pns = [".", ",", ":", "!", "?", " ", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

                    if (pns.indexOf (familydata[find - 2]) > -1) {
                        ;            /* do nothing */
                    }
                    else {
                        for (tf = find - 2; tf >= 0; tf--) {
                            if (familydata[tf] == "\n" || familydata[tf] == ' ') {
                                if ((familydata[tf + 1] >= 'A' && familydata[tf + 1] <= 'Z') || familydata.substring(tf + 1, tf + 7) == "------") {
                                    cnt = find;
                                    break;
                                }
                                else {
                                    break;
                                }
                            }
                        }
                        if (tf == 0 || cnt == find) {
                            cnt = find;   /* keep this in case tf == 0 */
                            continue;
                        }
                    }
                }
                else {
                    cnt = find;
                    continue;
                }

                if (!childsec) {
                    /* match lastname, allow for up to 2 words between firstname and lastname */
                    var cntw = 0;
                    for (fln = find; fln < familydata.length; fln++) {
                        if (familydata[fln] == ' ' || familydata[fln] == "\n") {
                            fln++;
                            if (postdata.lastname == familydata.substring (fln, fln + postdata.lastname.length)) {
                                /* matched on name; look for match on any other factors which are present */
                                if (misc.Look4Match (postdata, find, fln + postdata.lastname.length)) {      /* 1st, mid & last names */
                                    gotamatch = 1;
                                }
                                break;
                            }
                            else {
                                /* look ahead two more words for lastname */
                                cntw++;
                                if (cntw == 3)
                                    break;
                                else
                                    continue;
                            }
                        }
                    }

                    if (gotamatch) {
                        /* lastname should NOT be followed by a word which has some resemblance to a name */
                        tf = fln + postdata.lastname.length;
                        if (familydata[tf] == ' ') {
                            if (((familydata[tf + 1] >= 'A' && familydata[tf + 1] <= 'Z') || familydata.substring(tf + 1, tf + 7) == "------") &&
                                       (familydata.substring(tf + 1, tf + 7) != "County" && familydata.substring(tf + 1, tf + 9) != "Township" &&
                                  familydata.substring(tf + 1, tf + 10) != "Father - " && familydata.substring(tf + 1, tf + 10) != "Mother - ")) {
                                cnt = find;
                                continue;
                            }
                        }
                    }
                }
                else {
                    /* a match in the Children section */
                    gotamatch = misc.ChildrenMatch (find, postdata, find + postdata.firstname.length);
                    if (gotamatch == -1) {
                        cnt = find;
                        continue;
                    }
                }
            }

            if (postdata.firstname != '' && postdata.middlename == '' && postdata.lastname == '') {
                /* looking for firstname */
                var twoEOL, childsec;

                find = familydata.indexOf (postdata.firstname, cnt);
                if (find == -1)
                    /* search finished */
                    break;
                if (postdata.hasOwnProperty('SCit')) {
                    /* don't look in the Citation/Sources Section for matches */
                    if (misc.DetermineSection (find) == "Citations") {
                        cnt = find;
                        continue;
                    }
                }
                /* check if match is in Children section */
                childsec = 0;
                if (misc.DetermineSection (find) == "Children") {
                    childsec = 1;

                    /* match is in Children section; additional checks are different than for matches in other sections */
                    if (familydata[find - 1] == ' ' && familydata[find - 2] == ' ') {
                        /* matched on name; look for match on any other factors which are present */
                        if (misc.Look4Match (postdata, find, find + postdata.firstname.length)) {        /* 1st name */
                            gotamatch = 1;
                        }
                        else {
                            cnt = find;
                            continue;
                        }
                    }
                    else {
                        cnt = find;
                        continue;
                    }
                }
                else {
                    /* firstname needs to be followed by some semblance of a name if it's outside Children section */
                    tf = find + postdata.firstname.length;
                    if (familydata[tf] == ' ' || familydata[tf] == "\n") {
                        if (((familydata[tf + 1] >= 'A' && familydata[tf + 1] <= 'Z') || familydata.substring(tf + 1, tf + 7) == "------") &&
                                   (familydata.substring(tf + 1, tf + 7) != "County" && familydata.substring(tf + 1, tf + 9) != "Township" &&
                               familydata.substring(tf + 1, tf + 10) != "Father - " && familydata.substring(tf + 1, tf + 10) != "Mother - ")) {
                            ;   /* do nothing */
                        }
                        else {
                            cnt = find;
                            continue;
                        }
                    }
                    else {
                        cnt = find;
                        continue;
                    }
                }
                /* firstname should NOT be preceded by some semblance of a name */
                if ((familydata[find - 1] == ' ' || familydata[find - 1] == "\n") && !childsec) {
                    var pns = [".", ",", ":", "!", "?", " ", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

                    if (pns.indexOf (familydata[find - 2]) > -1) {
                        /* matched on name; look for match on any other factors which are present */
                        if (misc.Look4Match (postdata, find, find + postdata.firstname.length)) {            /* 1st name */
                            gotamatch = 1;
                        }
                        else {
                            cnt = find;
                            continue;
                        }
                    }
                    else {
                        for (tf = find - 2; tf >= 0; tf--) {
                            if (familydata[tf] == "\n" || familydata[tf] == ' ') {
                                if ((familydata[tf + 1] >= 'A' && familydata[tf + 1] <= 'Z') || familydata.substring(tf + 1, tf + 7) == "------") {
                                    cnt = find;
                                    break;
                                }
                                else {
                                    /* matched on name; look for match on any other factors which are present */
                                    if (misc.Look4Match (postdata, find, find + postdata.firstname.length)) {      /* 1st name */
                                        gotamatch = 1;
                                        break;
                                    }
                                }
                            }
                        }
                        if (tf == 0 || cnt == find) {
                            cnt = find;      /* keep this in case tf == 0 */
                            continue;
                        }
                    }
                }
            } 

            if (postdata.firstname == '' && postdata.middlename != '' && postdata.lastname != '') {
                /* looking for middlename & lastname */
                var twoEOL, tf;

                find = familydata.indexOf (postdata.middlename, cnt);
                if (find == -1)
                    /* search finished */
                    break;
                if (postdata.hasOwnProperty('SCit')) {
                    /* don't look in the Citation/Sources Section for matches */
                    if (misc.DetermineSection (find) == "Citations") {
                        cnt = find;
                        continue;
                    }
                }
                /* the word before the middlename should have some resemblance to a name */
                if (familydata[find - 1] != " ") {
                    cnt = find;
                    continue;
                }
                for (tf = find - 2; tf > 0; tf--)
                    if (familydata[tf] == ' ' || familydata[tf] == "\n")
                        break;
                if (tf > 0)
                    tf++;
                else
                    tf = 0;
                if (tf <= find - 2 && ((familydata[tf] >= 'A' && familydata[tf] <= 'Z') || familydata.substring(tf, tf + 6) == "------")) {
                    ; /* do nothing */
                }
                else {
                    cnt = find;
                    continue;
                }

                /* check if match is in Children section */
                childsec = 0;
                if (misc.DetermineSection (find) == "Children") {
                    childsec = 1;
                }
                else {
                    /* go to the next word & match on lastname */
                    for (fmn = find; fmn < familydata.length; fmn++) {
                        if (familydata[fmn] == ' ' || familydata[fmn] == "\n") {
                            fmn++;
                            if (postdata.lastname == familydata.substring (fmn, fmn + postdata.lastname.length)) {
                                /* lastname should NOT be followed by a word which has some resemblance to a name */
                                tf = fmn + postdata.lastname.length;
                                if (familydata[tf] == ' ')
                                    if ((familydata[tf + 1] >= 'A' && familydata[tf + 1] <= 'Z') ||
                                                                      familydata.substring(tf + 1, tf + 7) == "------")
                                        break;

                                /* matched on name; look for match on any other factors which are present */
                                if (misc.Look4Match (postdata, find, fmn + postdata.lastname.length))       /* mid & last names */
                                    gotamatch = 1;
                                break;
                            }
                            else {
                                break;
                            }
                        }
                    }
                }
                if (childsec) {
                    /* a match in the Children section */
                    gotamatch = misc.ChildrenMatch (find, postdata, find + postdata.middlename.length);
                    if (gotamatch == -1) {
                        cnt = find;
                        continue;
                    }
                }
            }

            if (postdata.firstname == '' && postdata.middlename != '' && postdata.lastname == '') {
                /* looking for middlename */
                var twoEOL, childsec, tf;

                find = familydata.indexOf (postdata.middlename, cnt);
                if (find == -1)
                    break;
                if (postdata.hasOwnProperty('SCit')) {
                    /* don't look in the Citation/Sources Section for matches */
                    if (misc.DetermineSection (find) == "Citations") {
                        cnt = find;
                        continue;
                    }
                }

                /* the word before the middlename should have some resemblance to a name */
                if (familydata[find - 1] != " ") {
                    cnt = find;
                    continue;
                }
                for (tf = find - 2; tf > 0; tf--)
                    if (familydata[tf] == ' ' || familydata[tf] == "\n")
                        break;
                if (tf > 0)
                    tf++;
                else
                    tf = 0;
                if (tf <= find - 2 && ((familydata[tf] >= 'A' && familydata[tf] <= 'Z') || familydata.substring(tf, tf + 6) == "------")) {
                    ; /* do nothing */
                }
                else {
                    cnt = find;
                    continue;
                }

                /* check if match is in Children section */
                childsec = 0;
                if (misc.DetermineSection (find) == "Children") {
                    childsec = 1;

                    /* middle name in Children section should be followed by a period */
                    if (familydata[find + postdata.middlename.length] == '.') {
                        /* matched on name; look for match on any other factors which are present */
                        if (misc.Look4Match (postdata, find, find + postdata.middlename.length)) {       /* mid name */
                            gotamatch = 1;
                        }
                        else {
                            cnt = find;
                            continue;
                        }
                    }
                    else {
                        cnt = find;
                        continue;
                    }
                }
                else {
                    /* if not in Children section, middlename should be followed by a word which has some resemblance to a name */
                    tf = find + postdata.middlename.length;
                    if (familydata[tf] == ' ' || familydata[tf] == "\n") {
                        if (((familydata[tf + 1] >= 'A' && familydata[tf + 1] <= 'Z') || familydata.substring(tf + 1, tf + 7) == "------") &&
                                    (familydata.substring(tf + 1, tf + 7) != "County" && familydata.substring(tf + 1, tf + 9) != "Township" &&
                               familydata.substring(tf + 1, tf + 10) != "Father - " && familydata.substring(tf + 1, tf + 10) != "Mother - ")) {
                            /* matched on name; look for match on any other factors which are present */
                            if (misc.Look4Match (postdata, find, tf)) {       /* mid name */
                                gotamatch = 1;
                            }
                            else {
                                cnt = find;
                                continue;
                            }
                        }
                        else {
                            cnt = find;
                            continue;
                        }
                    }
                    else {
                        cnt = find;
                        continue;
                    }
                }
            }

            if (postdata.firstname == '' && postdata.middlename == '' && postdata.lastname != '') {
                /* looking for lastname */
                find = familydata.indexOf (postdata.lastname, cnt);
                if (find == -1)
                    break;
                if (postdata.hasOwnProperty('SCit')) {
                    /* don't look in the Citation/Sources Section for matches */
                    if (misc.DetermineSection (find) == "Citations") {
                        cnt = find;
                        continue;
                    }
                }

                /* the word before the lastname should have some resemblance to a name */
                if (familydata[find - 1] != " ") {
                    cnt = find;
                    continue;
                }
                var tf;
                for (tf = find - 2; tf > 0; tf--)
                    if (familydata[tf] == ' ' || familydata[tf] == "\n")
                        break;
                if (tf > 0)
                    tf++;
                else
                    tf = 0;
                if (tf <= find - 2 && ((familydata[tf] >= 'A' && familydata[tf] <= 'Z') || familydata.substring(tf, tf + 6) == "------")) {
                    ; /* do nothing */
                }
                else {
                    cnt = find;
                    continue;
                }

                /* lastname should NOT be followed by a word which has some resemblance to a name */
                tf = find + postdata.lastname.length;
                if (familydata[tf] == ' ') {
                    if (((familydata[tf + 1] >= 'A' && familydata[tf + 1] <= 'Z') || familydata.substring(tf + 1, tf + 7) == "------") &&
                               (familydata.substring(tf + 1, tf + 7) != "County" && familydata.substring(tf + 1, tf + 9) != "Township" &&
                           familydata.substring(tf + 1, tf + 10) != "Father - " && familydata.substring(tf + 1, tf + 10) != "Mother - ")) {
                        cnt = find;
                        continue;
                    }
                }
                /* matched on name; look for match on any other factors which are present */
                if (misc.Look4Match (postdata, find, tf))       /* last name */
                    gotamatch = 1;
            }

            if (gotamatch) {
                /* find family ID */
                var idind, hid;

                for (idind = find; idind >= 0; idind--) {
                    if (familydata.substring (idind - 3, idind) === "\n\n\n") {
                        hid = familydata.substring (idind, familydata.indexOf (' ', idind));
                        break;
                    }
                }
                if (gotamatch == 1)
                    Sdata += "found '";
                else
                    Sdata += "found possible '";
                if (postdata.firstname != '')
                    Sdata += postdata.firstname;
                if (postdata.middlename != '') {
                    if (postdata.firstname != '')
                        Sdata += " ";
                    Sdata += postdata.middlename;
                }
                if (postdata.lastname != '') {
                    if (postdata.firstname != '' || postdata.middlename != '')
                        Sdata += " ";
                    Sdata += postdata.lastname;
                }
                Sdata += "' in family " + hid + os.EOL;
                cntmatches++;

                /* go to next family group */
                cnt = familydata.indexOf ("\n\n\n", find);
                if (cnt == -1)
                    cnt = familydata.length;
            }
            else {
                cnt = find;
            }
        }
    }

    Sdata += os.EOL + "Found " + cntmatches;
    if (cntmatches == 1)
        Sdata += " match" + os.EOL;
    else
        Sdata += " matches" + os.EOL;
    Sdata += os.EOL + os.EOL + "End of Search Results" + os.EOL;
    Sdata += "</pre> <script type=\"text/javascript\" src=\"clib.js\"></script> <button id='printPB' " +
             "onclick='userPrint(\"Search\")'>Print Search Results</button> </body> </html>";
    return Sdata;
}

module.exports = { Search };

