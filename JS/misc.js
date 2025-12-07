const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const fetch = require('node-fetch');

/* read active family data */
function ReadFamilyDB (F) {
    if (F != "FORCE")
        /* if not forcing read and familydata has already been read, return */
        if (familydata != "")
            return 1;
    familydata = '';

    var dirin = path.join(ProcessDBSysInfo ("DBLocation"), "PlainText");
    if (dirin == -1)
        return -1;          /* no DB activated */
    var cntb = 0, x, cntx;
    /* do a pass through the directory summing the file sizes to make sure reading them all won't exceed the max string length (200MB) */
    x = 0;
    fs.readdirSync(dirin).forEach(file => {
        if ("body" === file.substring(0,4)) {
            const Absolute = path.join(dirin, file);
            var stats = fs.statSync(Absolute);
            x += stats.size;
        }
    })
    if (x > 200000000) {
        Logging("*****Cannot read the Family Data; total size too big (exceeds 200MB).*****");
        return -2;
    }

    /* pass through the directory reading the Family files */
    fs.readdirSync(dirin).forEach(file => {
        if ("body" === file.substring(0,4)) {
            const Absolute = path.join(dirin, file);
            if (!(fs.statSync(Absolute).isDirectory()) && !(fs.statSync(Absolute).isSymbolicLink())) {
                try {
                    var thold = fs.readFileSync(Absolute, 'utf8');
                }
                catch (err) {
                    Logging(err + "; problem reading '" + Absolute + "'.");
                }
                if (familydata == "")
                    familydata += "\n\n\n";                   /* start familydata with 3 empty lines since the beginning of a family must */
                                                              /* be preceeded by 3 empty lines for processing and validation purposes */
                /* count number of CRs at end of thold, and try to ensure that familydata has 3 blank lines at end */
                for (cntx = 0, x = thold.length - 1; x > 0; x--)
                    if (thold[x] == "\n")
                        cntx++;
                    else
                        break;
                familydata += thold;
                for (x = 0; x <= (3 - cntx); x++)
                    familydata += "\n";   /* separate the last family in this data from the first family in the next data */
                cntb++;
            }
        }
    })
    familydata = familydata.replace(/\r\n/g, '\n');
    if (!cntb)
        return 0;
    else
        return 1;
}

/* read any family data (usually non-active) */
function loadFamDB(FamDBName) {
    var famdata = '';
    var dirin = ProcessDBSysInfo ("AnyDBLocation", FamDBName);
    if (dirin == -1)
        return -1;          /* no DB found */
    var dirin = path.join(dirin, "PlainText");
    var cntb = 0, x, cntx;
    /* do a pass through the directory summing the file sizes to make sure reading them all won't exceed the max string length (200MB) */
    x = 0;
    fs.readdirSync(dirin).forEach(file => {
        if ("body" === file.substring(0,4)) {
            const Absolute = path.join(dirin, file);
            var stats = fs.statSync(Absolute);
            x += stats.size;
        }
    })
    if (x > 200000000) {
        Logging("*****Cannot read the Family Data; total size too big (exceeds 200MB).*****");
        return -2;
    }

    /* pass through the directory reading the Family files */
    fs.readdirSync(dirin).forEach(file => {
        if ("body" === file.substring(0,4)) {
            const Absolute = path.join(dirin, file);
            if (!(fs.statSync(Absolute).isDirectory()) && !(fs.statSync(Absolute).isSymbolicLink())) {
                try {
                    var thold = fs.readFileSync(Absolute, 'utf8');
                }
                catch (err) {
                    Logging(err + "; problem reading '" + Absolute + "'.");
                }
                if (famdata == "")
                    famdata += "\n\n\n";                   /* start famdata with 3 empty lines since the beginning of a family must */
                                                           /* be preceeded by 3 empty lines for processing and validation purposes */
                /* count number of CRs at end of thold, and try to ensure that famdata has 3 blank lines at end */
                for (cntx = 0, x = thold.length - 1; x > 0; x--)
                    if (thold[x] == "\n")
                        cntx++;
                    else
                        break;
                famdata += thold;
                for (x = 0; x <= (3 - cntx); x++)
                    famdata += "\n";   /* separate the last family in this data from the first family in the next data */
                cntb++;
            }
        }
    })
    famdata = famdata.replace(/\r\n/g, '\n');
    if (!cntb)
        return 0;
    else
        return famdata;

}

/* read index file associated with family data */
function ReadIndex () {
    var Absolute = path.join(ProcessDBSysInfo ("DBLocation"), "PlainText", "index");
    if (fs.existsSync(Absolute)) {
        if (!(fs.statSync(Absolute).isDirectory()) && !(fs.statSync(Absolute).isSymbolicLink())) {
            try {
                famindex = fs.readFileSync(Absolute, 'utf8');
                famindex = famindex.replace(/\r\n/g, '\n');
            }
            catch (err) {
                Logging(err + "; problem reading '" + Absolute + "'.");
                return 0;
            }
        }
    } else
        return 0;
    return 1;
}

/* analyze DBSysInfo and return what's asked for */
function ProcessDBSysInfo (what, param) {
    if (what == "SysLocation") {
        /* get SysLocation, always located at beginning of file */
        var datapos = DBSysInfo.indexOf("\"", 0);
        if (datapos == -1)
            return -1;
        datapos++;
        var secondquote = DBSysInfo.indexOf("\"", datapos);
        if (secondquote == -1)
            return -1;
        else
            return (DBSysInfo.substring(datapos, secondquote));
    }
    if (what == "dbNameUnique") {
        /* check if DBName is unique */
        return (DBSysInfo.includes(param));
    }
    if (what == "DBLocation") {
        /* get DBLocation of active DB */
        var activepos = DBSysInfo.indexOf("DBActive = \"yes\"", 0);
        var locpos = DBSysInfo.indexOf("DBLocation = \"", activepos);
        if (activepos === -1 || locpos === -1)
            return -1;
        locpos += 14;
        var secondquote = DBSysInfo.indexOf("\"", locpos);
        if (secondquote === -1)
            return -1;
        else
            return (DBSysInfo.substring(locpos, secondquote));
    }
    if (what == "AnyDBLocation") {
        /* get DBLocation of any DB */
        var nmpos = DBSysInfo.indexOf('DBName = "' + param + '"');
        if (nmpos == -1)
            return -1;
        var dbloc = DBSysInfo.indexOf('DBLocation = ', nmpos);
        var quote1 = DBSysInfo.indexOf("\"", dbloc) + 1;
        var quote2 = DBSysInfo.indexOf("\"", quote1);
        return (DBSysInfo.substring(quote1, quote2));
    }
    if (what == "DBName") {
        /* get DBName of active DB */
        var activepos = DBSysInfo.indexOf("DBActive = \"yes\"", 0);
        var namepos = DBSysInfo.indexOf("DBName = \"", activepos);
        if (activepos === -1 || namepos === -1)
            return -1;
        namepos += 10;
        var secondquote = DBSysInfo.indexOf("\"", namepos);
        if (secondquote === -1)
            return -1;
        else
            return (DBSysInfo.substring(namepos, secondquote));
    }
    if (what == "ID") {
        /* get UserID in active DB */
        var activepos = DBSysInfo.indexOf("DBActive = \"yes\"", 0);
        var idpos = DBSysInfo.indexOf("DBUserID = \"", activepos);
        if (activepos === -1 || idpos === -1)
            return -1;
        idpos += 12;
        var secondquote = DBSysInfo.indexOf("\"", idpos);
        if (secondquote === -1)
            return -1;
        else
            return (DBSysInfo.substring(idpos, secondquote));
    }
    if (what == "DBStatus") {
        /* get DBStatus of active DB */
        var activepos = DBSysInfo.indexOf("DBActive = \"yes\"", 0);
        var statuspos = DBSysInfo.indexOf("DBStatus = \"", activepos);
        if (activepos === -1 || statuspos === -1)
            return -1;
        statuspos += 12;
        return (DBSysInfo.substring(statuspos, statuspos + 1));           /* DBStatus is always 1 position */
    }
    if (what == "DBFormat") {
        /* get DBFormat of active DB */
        var activepos = DBSysInfo.indexOf("DBActive = \"yes\"", 0);
        var formatpos = DBSysInfo.indexOf("DBFormat = \"", activepos);
        if (activepos === -1 || formatpos === -1)
            return -1;
        formatpos += 12;
        return (DBSysInfo.substring(formatpos, formatpos + 1));           /* DBFormat is always 1 position */
    }
    if (what == "AllDBNameDBActive") {
        /* get all DBName's and associated DBActive values */
        var findings = '', i = 0, secondquote;
        while (i = DBSysInfo.indexOf("DBActive = ", i)) {
            if (i == -1)
                break;
            i += 12;
            secondquote = DBSysInfo.indexOf("\"", i);
            findings += DBSysInfo.substring(i, secondquote);
            findings += ",";

            i = DBSysInfo.indexOf("DBName = \"", i);
            i += 10;
            secondquote = DBSysInfo.indexOf("\"", i);
            findings += DBSysInfo.substring(i, secondquote);
            findings += ",";
        }
        if (findings == '')
            return (findings);
        else
            return (findings.slice(0, findings.length - 1));         /* don't return last character (a comma) */
    }
    if (what == "AllDBNames") {
        /* get all DBName's */
        var findings = '', i = 0, secondquote;
        while (i = DBSysInfo.indexOf("DBName = ", i)) {
            if (i == -1)
                break;
            i += 10;
            secondquote = DBSysInfo.indexOf("\"", i);
            findings += DBSysInfo.substring(i, secondquote);
            findings += ",";
        }
        if (findings == '')
            return (findings);
        else
            return (findings.slice(0, findings.length - 1));         /* don't return last character (a comma) */
    }
}

/* return DBinfo.txt or -1 if no DataBase active or -2 if DBinfo.txt doesn't exist */
function DBInfo () {
    if (ProcessDBSysInfo ("DBLocation") == -1)
        return -1;
    else
        var loc = path.join(ProcessDBSysInfo ("DBLocation"), "/Other/DBinfo.txt");
    if (!fs.existsSync(loc))
        return -2;
    else {
        try {
            /* load info regarding active DB; it's a small file & ok to read synchronously */
            var dbinfo = fs.readFileSync(loc, 'utf8');
            dbinfo = dbinfo.replace(/\r\n/g, '\n');
            return (dbinfo);
        }
        catch (err) {
            Logging(err + "; problem reading '" + loc + "'.");
        }
    }
}

/* create an index of proper names for the active Family DB */
function DBIndex (pdirectives) {
    var x;
    const directives = JSON.parse(pdirectives);
    const index = {};

    /* find first character not a space nor newline */
    for (x = 0; x < familydata.length; x++)
        if (familydata[x] == ' ' || familydata[x] == '\n' || familydata[x] == '\r')
            continue;
        else
            break;
    if (x == familydata.length) {
        Logging("Create Index - There doesn't seem to be any data to index!  Index file not created.");
        return "Creating new index for " + ProcessDBSysInfo("DBName") + " FAILED. There doesn't seem to be any data to index.";
    }

    const fData = familydata.substring(x);
    const familyGroups = fData.split(os.EOL + os.EOL + os.EOL + os.EOL);

    familyGroups.forEach(group => {
        if (group == "" || group.includes("OPEN"))
            return;
        const groupId = group.substring(0, group.indexOf("  "));
        if (!groupId)
            return;

        const processName = (name) => {
            if (name.includes("New Jersey") || name.includes("New York") || name.includes("Citation") || name.includes("Township") ||
                                               name.includes("Question") || name.includes("Cemetery") || name.includes("County") ||
                                               name.includes("The ") || name.includes("Timeline"))
                return;

            const nameT = name.replace(/\[.*?\]/g, '').trim();    // remove Citation references
            const parts = nameT.split(/\s+/);
            if (parts.length === 0)
                return;

            let lastName = parts[parts.length - 1];
            let firstName = parts[0];
            let middleName = parts.slice(1, parts.length - 1).join(' ');

            if (lastName.endsWith("'s"))
                lastName = lastName.slice(0, -2);
            if (lastName.endsWith('.') || lastName.endsWith("'"))
                lastName = lastName.slice(0, -1);
            
            if (lastName.includes("------"))
                return;                                   // don't include unknown lastNames in index

            if (middleName) {
                // certain words ending the middleName should be part of the lastName
                if (/( van der| van de| van den)$/i.test(middleName)) {
                    var pos1 = middleName.lastIndexOf(' ');
                    var pos2 = middleName.lastIndexOf(' ', pos1 - 1)
                    lastName = middleName.substring(pos2 + 1) + ' ' + lastName;
                    middleName = middleName.substring(0, pos2);
                }
                if (/( van| von| la| le| de)$/i.test(middleName)) {
                    lastName = middleName.substring(middleName.lastIndexOf(' ') + 1) + ' ' + lastName;
                    middleName = middleName.substring(0, middleName.lastIndexOf(' '));
                }
                if (/^(van)$/i.test(middleName) || /^(von)$/i.test(middleName) || /^(la)$/i.test(middleName) || /^(le)$/i.test(middleName) ||
                                           /^(de)$/i.test(middleName) || /^(van der)$/i.test(middleName) || /^(van de)$/i.test(middleName) ||
                                           /^(van den)$/i.test(middleName)) {
                    lastName = middleName + ' ' + lastName;
                    middleName = '';
                }
            }

            let formattedName;
            if (middleName)
                formattedName = `${lastName}, ${firstName} ${middleName}`;
            else
                formattedName = `${lastName}, ${firstName}`;
            if (!index[formattedName])
                index[formattedName] = new Set();
            index[formattedName].add(groupId);
        }

        if (directives.HOF == "on" || directives.HOFS == "on") {
            // process Head of Family person/people in the family group
            // for every "Father -" occurrence in a Family Group, there will be an HOF
            var pntFather = 0;
            while (1) {
                pntFather = group.indexOf("Father - ", pntFather);
                if (pntFather == -1)
                    break;
                var HOF = group.lastIndexOf ("  ", pntFather);
                if (HOF == -1)
                    break;
                HOF += 2;
                var mainPersonMatch = group.substring(HOF, group.indexOf("\n", HOF));
                if (mainPersonMatch)
                    processName(mainPersonMatch.trim());
                pntFather++;
            }
        }
        if (directives.HOFS == "on") {
            // process Father - there can be multiple Father lines in one Family Group
            var pntFather = 0;
            while (1) {
                pntFather = group.indexOf("Father - ", pntFather);
                if (pntFather == -1)
                    break;
                var Father = pntFather + 10;
                // position at first character of name
                for (var x = 0; group[Father + x] != '\n'; x++)
                    if (/^[a-zA-Z]$/.test(group[Father + x]))
                        break;
                if (group[Father + x] == '\n')
                    break;                        // name not found
                else
                    Father += x;
                var mainPersonMatch = group.substring(Father, group.indexOf("\n", Father));
                if (mainPersonMatch && !mainPersonMatch.includes("unknown"))
                    processName(mainPersonMatch.trim());
                pntFather++;
            }

            // process Mother - there can be multiple Mother lines in one Family Group
            var pntMother = 0;
            while (1) {
                pntMother = group.indexOf("Mother - ", pntMother);
                if (pntMother == -1)
                    break;
                var Mother = pntMother + 10;
                // position at first character of name
                for (var x = 0; group[Mother + x] != '\n'; x++)
                    if (/^[a-zA-Z]$/.test(group[Mother + x]))
                        break;
                if (group[Mother + x] == '\n')
                    break;                        // name not found
                else
                    Mother += x;
                var mainPersonMatch = group.substring(Mother, group.indexOf("\n", Mother));
                if (mainPersonMatch && !mainPersonMatch.includes("unknown"))
                    processName(mainPersonMatch.trim());
                pntMother++;
            }
        }
        if (directives.TL == "on") {
            // process Timeline
            var TLPnt = group.indexOf("Timeline -");
            if (TLPnt != -1) {
                const end = findFirstOccurrence(group.substring(TLPnt + 1));
                var Timeline = group.substring(TLPnt + 11, TLPnt + 11 + end);
                const people = new Set();
                const lines = Timeline.split('\n');

                for (const line of lines) {
                    const event = line.substring(12);
                    if (event.startsWith("child #"))
// figure surname of child & process it
                        continue;

                    const nameParts = findProperName(event);

                    // Join the collected name parts and perform final cleanup (remove citation references) 
                    let mainPerson = null;
                    if (nameParts.length > 0)
                        mainPerson = nameParts.join(' ').trim();

                    // Check if a valid mainPerson was found and contains a space (implies at least two words) 
                    if (mainPerson && mainPerson.includes(" "))
                        processName(mainPerson);

                    for (const indicator of ['married']) {
                        const indicatorIndex = event.toLowerCase().indexOf(indicator);
                        if (indicatorIndex !== -1) {
                            const namesBeforeIndicator = event.substring(event.lastIndexOf(" and ", indicatorIndex) + 5, indicatorIndex).trim();
                            const nameParts = findProperName(namesBeforeIndicator);
                            // Join the collected name parts and perform final cleanup (remove citation references) 
                            let mainPerson = null;
                            if (nameParts.length > 0)
                                mainPerson = nameParts.join(' ').trim();
                            if (mainPerson && mainPerson.includes(" "))
                                processName(mainPerson);
                            const by = event.indexOf(" by ");
                            if (by != -1) {
                                //index proper name after " by "
                                var nameAfterBy = event.substring(by + 4).trim();
                                if (nameAfterBy.startsWith("Reverend "))
                                    nameAfterBy = nameAfterBy.substring(9);
                                if (nameAfterBy.startsWith("Rev. "))
                                    nameAfterBy = nameAfterBy.substring(5);
                                if (nameAfterBy.startsWith("Rev "))
                                    nameAfterBy = nameAfterBy.substring(4);
                                if (nameAfterBy.startsWith("Father "))
                                    nameAfterBy = nameAfterBy.substring(7);
                                if (nameAfterBy.startsWith("Justice of the Peace "))
                                    nameAfterBy = nameAfterBy.substring(21);
                                if (nameAfterBy.startsWith("Justice ") || nameAfterBy.startsWith("Brother "))
                                    nameAfterBy = nameAfterBy.substring(8);
                                if (nameAfterBy.startsWith("JP "))
                                    nameAfterBy = nameAfterBy.substring(3);

                                const nameParts = findProperName(nameAfterBy);
                                // Join the collected name parts and perform final cleanup (remove citation references) 
                                let mainPerson = null;
                                if (nameParts.length > 0)
                                    mainPerson = nameParts.join(' ').trim();
                                if (mainPerson && mainPerson.includes(" "))
                                    processName(mainPerson);
                            }
                        }
                    }
                    for (const indicator of [' purchases ', ' purchased ']) {
                        const indicatorIndex = event.toLowerCase().indexOf(indicator);
                        if (indicatorIndex !== -1) {
                            const by = event.indexOf(" from ");
                            if (by != -1) {
                                //index proper name after " from "
                                var nameAfterBy = event.substring(by + 4).trim();
                                const fullNamePattern =
                                     /(?:^|\s)((?:------|[A-Z][a-z]+|\b[A-Z]\.)(?:\s(?:[A-Z][a-z]+|\b[A-Z]\.|van|von|der|de|den|la|le)){0,3})\b/g;

                                let match;
                                while ((match = fullNamePattern.exec(nameAfterBy)) !== null) {
                                    const name = match[1].trim();
                                    if (name && name.includes(" "))
                                        processName(name);
                                }
                            }
                        }
                    }
                    for (const indicator of [' sells ', ' sold ']) {
                        const indicatorIndex = event.toLowerCase().indexOf(indicator);
                        if (indicatorIndex !== -1) {
                            const by = event.indexOf(" to ");
                            if (by != -1) {
                                //index proper name after " to "
                                var nameAfterBy = event.substring(by + 4).trim();
                                const fullNamePattern =
                                     /(?:^|\s)((?:------|[A-Z][a-z]+|\b[A-Z]\.)(?:\s(?:[A-Z][a-z]+|\b[A-Z]\.|van|von|der|de|den|la|le)){0,3})\b/g;

                                let match;
                                while ((match = fullNamePattern.exec(nameAfterBy)) !== null) {
                                    const name = match[1].trim();
                                    if (name && name.includes(" "))
                                        processName(name);
                                }
                            }
                        }
                    }
                }
            }
        }
        if (directives.Notes == "on") {
            // process Notes
            var NotesPnt = group.indexOf("Notes -");
            if (NotesPnt != -1) {
                const end = findFirstOccurrence(group.substring(NotesPnt + 1));
                var Notes = group.substring(NotesPnt + 8, NotesPnt + 8 + end);
                const people = new Set();
                const lines = Notes.split('\n');

                for (const line of lines) {
                    if (line.startsWith("Child #"))
// figure surname of child & process it
                        continue;
                    const nameParts = findProperName(line);
                    // Join the collected name parts and perform final cleanup (remove citation references) 
                    let mainPerson = null;
                    if (nameParts.length > 0)
                        mainPerson = nameParts.join(' ').trim();
                    if (mainPerson && mainPerson.includes(" "))
                        processName(mainPerson);

                    // Process events/facts separated by semi-colons 
                    const facts = line.split(';');
                    for (const fact of facts) {
                        for (const indicator of ['son of', 'daughter of', 'sister of', 'brother of', 'married']) {
                            const indicatorIndex = fact.toLowerCase().indexOf(indicator);
                            if (indicatorIndex !== -1) {
                                const namesAfterIndicator = fact.substring(indicatorIndex + indicator.length).trim();
                                // This pattern is for one or two proper names after the indicator 
                                const fullNamePattern =
                                     /(?:^|\s)((?:------|[A-Z][a-z]+|\b[A-Z]\.)(?:\s(?:[A-Z][a-z]+|\b[A-Z]\.|van|von|der|de|den|la|le)){0,3})\b/g;

                                let match;
                                while ((match = fullNamePattern.exec(namesAfterIndicator)) !== null) {
                                    const name = match[1].trim();
                                    if (name && name.includes(" "))
                                        processName(name);
                                }
                            }
                        }

                        for (const indicator of ['married']) {
                            const indicatorIndex = fact.toLowerCase().indexOf(indicator);
                            if (indicatorIndex !== -1) {
                                const by = fact.indexOf(" by ");
                                if (by != -1) {
                                    //index proper name after " by "
                                    var nameAfterBy = fact.substring(by + 4).trim();
                                    if (nameAfterBy.startsWith("Reverend "))
                                        nameAfterBy = nameAfterBy.substring(9);
                                    if (nameAfterBy.startsWith("Rev. "))
                                        nameAfterBy = nameAfterBy.substring(5);
                                    if (nameAfterBy.startsWith("Rev "))
                                        nameAfterBy = nameAfterBy.substring(4);
                                    if (nameAfterBy.startsWith("Father "))
                                        nameAfterBy = nameAfterBy.substring(7);
                                    if (nameAfterBy.startsWith("Justice of the Peace "))
                                        nameAfterBy = nameAfterBy.substring(21);
                                    if (nameAfterBy.startsWith("Justice ") || nameAfterBy.startsWith("Brother "))
                                        nameAfterBy = nameAfterBy.substring(8);
                                    if (nameAfterBy.startsWith("JP "))
                                        nameAfterBy = nameAfterBy.substring(3);

                                    const nameParts = findProperName(nameAfterBy);
                                    // Join the collected name parts and perform final cleanup (remove citation references) 
                                    let mainPerson = null;
                                    if (nameParts.length > 0)
                                        mainPerson = nameParts.join(' ').trim();
                                    if (mainPerson && mainPerson.includes(" "))
                                        processName(mainPerson);
                                }
                            }
                        }
                    }
                }
            }
        }
        if (directives.Extras == "on") {
            // process Extras
            var EPnt = group.indexOf("Extras -");
            if (EPnt != -1) {
                const end = findFirstOccurrence(group.substring(EPnt + 1));
                var Extras = group.substring(EPnt + 9, EPnt + 9 + end);
                const people = new Set();
                const lines = Extras.split('\n');

                for (const line of lines) {
                    if (line.startsWith("Child #"))
// figure surname of child & process it
                        continue;

                    const nameParts = findProperName(line);

                    // Join the collected name parts and perform final cleanup (remove citation references) 
                    let mainPerson = null;
                    if (nameParts.length > 0)
                        mainPerson = nameParts.join(' ').trim();

                    // Check if a valid mainPerson was found and contains a space (implies at least two words) 
                    if (mainPerson && mainPerson.includes(" "))
                        processName(mainPerson);
                }
            }
        }
        if (directives.Exp == "on") {
            // process Explanations
            var EPnt = group.indexOf("Explanations -");
            if (EPnt != -1) {
                const end = findFirstOccurrence(group.substring(EPnt + 1));
                var Extras = group.substring(EPnt + 15, EPnt + 15 + end);
                const people = new Set();
                const lines = Extras.split('\n');

                for (const line of lines) {
                    if (line.startsWith("Child #"))
// figure surname of child & process it
                        continue;

                    const nameParts = findProperName(line);

                    // Join the collected name parts and perform final cleanup (remove citation references) 
                    let mainPerson = null;
                    if (nameParts.length > 0)
                        mainPerson = nameParts.join(' ').trim();

                    // Check if a valid mainPerson was found and contains a space (implies at least two words) 
                    if (mainPerson && mainPerson.includes(" "))
                        processName(mainPerson);
                }
            }
        }
        if (directives.Qst == "on") {
            // process Questions
            var QPnt = group.indexOf("Questions -");
            if (QPnt != -1) {
                const end = findFirstOccurrence(group.substring(QPnt + 1));
                var Questions = group.substring(QPnt + 12, QPnt + 12 + end);
                const people = new Set();
                const lines = Questions.split('\n');

                for (const line of lines) {
                    if (line.startsWith("Child #"))
// figure surname of child & process it
                        continue;
                    if (line.startsWith("Citation #"))
                        continue;

                    const nameParts = findProperName(line);

                    // Join the collected name parts and perform final cleanup (remove citation references) 
                    let mainPerson = null;
                    if (nameParts.length > 0)
                        mainPerson = nameParts.join(' ').trim();
                    // Check if a valid mainPerson was found and contains a space (implies at least two words) 
                    if (mainPerson && mainPerson.includes(" "))
                        processName(mainPerson);

                    for (const indicator of ['son of', 'daughter of', 'sister of', 'brother of', 'married']) {
                        const indicatorIndex = line.toLowerCase().indexOf(indicator);
                        if (indicatorIndex !== -1) {
                            const namesAfterIndicator = line.substring(indicatorIndex + indicator.length).trim();
                            // This pattern is for one or two proper names after the indicator 
                            const fullNamePattern =
                                 /(?:^|\s)((?:------|[A-Z][a-z]+|\b[A-Z]\.)(?:\s(?:[A-Z][a-z]+|\b[A-Z]\.|van|von|der|de|den|la|le)){0,3})\b/g;

                            let match;
                            while ((match = fullNamePattern.exec(namesAfterIndicator)) !== null) {
                                const name = match[1].trim();
                                if (name && name.includes(" "))
                                    processName(name);
                            }
                        }
                    }
                }
            }
        }
        if (directives.Chld == "on") {
            // process Children

        }
        if (directives.Cite == "on") {
            // process Citations
            var CPnt = group.indexOf("Citation -"), CCnt;
            if (CPnt != -1)
                CCnt = 11;
            else {
                var CPnt = group.indexOf("Citations -");
                CCnt = 12;
            }

            if (CPnt != -1) {            // CPnt should never be -1 since a Citation/Citations section is mandatory
                const end = findFirstOccurrence(group.substring(CPnt + 1));
                var Citations = group.substring(CPnt + CCnt, CPnt + CCnt + end);
                const people = new Set();
                const lines = Citations.split('\n');

                for (const line of lines) {
                    const nameParts = findProperName(line);
                    // Join the collected name parts and perform final cleanup (remove citation references) 
                    let mainPerson = null;
                    if (nameParts.length > 0)
                        mainPerson = nameParts.join(' ').trim();

                    // Check if a valid mainPerson was found and contains a space (implies at least two words) 
                    if (mainPerson && mainPerson.includes(" "))
                        processName(mainPerson);

                    const quote1 = line.indexOf('"');
                    var quote2 = -1;
                    if (quote1 != -1) {
                        quote2 = line.indexOf('"', quote1 + 1);
                        if (quote2 != -1) {
                            const nameParts = findProperName(line.substring(quote2 + 2).trim());
                            // Join the collected name parts and perform final cleanup (remove citation references) 
                            let mainPerson = null;
                            if (nameParts.length > 0)
                                mainPerson = nameParts.join(' ').trim();
                            if (mainPerson && mainPerson.includes(" "))
                                processName(mainPerson);
                        }
                    }
                    if (quote2 == -1)
                        quote2 = 0;
                    const Cof = line.indexOf(" of ", quote2);   // don't look for " of " inside quoted text
                    if (Cof != -1) {
                        /* try to pick up a name if there is one */
                        const nameParts = findProperName(line.substring(Cof + 4).trim());
                        // Join the collected name parts and perform final cleanup (remove citation references) 
                        let mainPerson = null;
                        if (nameParts.length > 0)
                            mainPerson = nameParts.join(' ').trim();
                        if (mainPerson && mainPerson.includes(" "))
                            processName(mainPerson);
                    }
                }
            }
        }
    })

    const sortedIndex = {};
    Object.keys(index).sort((a, b) => {
        const getLastNameForSort = (nameString) => {
            const lastName = nameString.split(',')[0];
            // Remove all whitespace and apostrophies (for sorting), and convert to lowercase
            return lastName.replace(/[\s']/g, '').toLowerCase();
        }

        const getFirstNameForSort = (nameString) => {
            // Find the part after the comma and remove leading/trailing whitespace
            const firstNameMatch = nameString.split(',')[1];
            if (firstNameMatch)
                return firstNameMatch.trim();
            return '';
        }

        const lastNameA = getLastNameForSort(a);
        const lastNameB = getLastNameForSort(b);

        const firstNameA = getFirstNameForSort(a);
        const firstNameB = getFirstNameForSort(b);

        // Use localeCompare for robust string comparison, which can handle various locales and is more efficient for large arrays.
        // 'base' sensitivity ignores case and accents.
        const comparison = lastNameA.localeCompare(lastNameB, undefined, { sensitivity: 'base' });
        if (comparison !== 0)
            return comparison;

        // Custom logic to sort firstnames starting with '------' to the end of the list.
        const isFirstNameA_Placeholder = firstNameA.startsWith('------');
        const isFirstNameB_Placeholder = firstNameB.startsWith('------');

        if (isFirstNameA_Placeholder && !isFirstNameB_Placeholder)
            return 1; // '------' names come after non-'------' names
        if (!isFirstNameA_Placeholder && isFirstNameB_Placeholder)
            return -1; // non-'------' names come before '------' names

        // If both are placeholders or neither are, use regular localeCompare for the full name.
        return a.localeCompare(b);
    }).forEach(key => {
        // Convert Set to Array for sorting
        const idsArray = Array.from(index[key]);

        // Custom sort function for IDs
        idsArray.sort((a, b) => {
            const [aLeft, aRight] = a.split('.').map(Number);
            const [bLeft, bRight] = b.split('.').map(Number);
            if (aLeft !== bLeft)
                return aLeft - bLeft; // Primary sort by number to the left of the period
            return aRight - bRight; // Secondary sort by number to the right of the period
        })

        sortedIndex[key] = idsArray.join(', ');
    })

    let result = '';
    for (const name in sortedIndex)
        result += (name + "  " + sortedIndex[name] + "\n");
    // count number of entries in result (index)
    for (var cntentries = 0, x = 0; x < result.length; x++)
        if (result[x] == '\n')
            cntentries++;

    /* back up index file if it exists */
    var contents = '', ibu = '', dhtml = 0, indexSW = 0;
    var Dir = path.join(ProcessDBSysInfo ("DBLocation"), "PlainText");
    const regex = /^index$/;
    contents = fs.readdirSync(Dir);
    if (contents !== '') {
        contents.forEach(file => {
            if (regex.test(file))
                indexSW = 1;
        })
    }
    if (indexSW) {
        var cntd = 0;
        contents.forEach(file => {
            if (file.indexOf('index.ORIG') !== -1)
                cntd++;
        })
        try {
            fs.renameSync(path.join(Dir, "index"), path.join(Dir, "index.ORIG") + cntd);
            ibu = "index.ORIG" + cntd;
            Logging ('Backed up "' + Dir + "/index" + '" to "' + Dir + "/" + ibu + '".');
        }
        catch (err) {
            Logging(err + "; problem backing up '" + Dir + "/index" + '" to ' + Dir + "/index.ORIG" + cntd + '.');
            return "Creating new index for " + ProcessDBSysInfo("DBName") + " FAILED. Could not back up original index file.";
        }
    }

    /* delete HTML version of DB if it exists */
    var DBloc = ProcessDBSysInfo ("DBLocation");
    var res = fs.existsSync(path.normalize(DBloc + '/HTML/tableofcontents.html'));
    if (res) {
        try {
            /* remove HTML version */
            fs.rmSync(path.normalize(DBloc + "/HTML"), { recursive: true, force: true });
            dhtml = 1;
            Logging("Deleted HTML version of active Family DataBase.");
        }
        catch (err) {
            Logging(err + "; problem deleting HTML version of active Family DataBase.");
            return "Creating new index for " + ProcessDBSysInfo("DBName") + " FAILED. Could not remove HTML version of active Family DataBase.";
        }
    }

    /* write new index file */
    try {
        fs.writeFileSync(path.join(Dir, "index"), result);
        Logging("Created index for " + ProcessDBSysInfo("DBName") + ".");
        var msg = "OKIndex for " + ProcessDBSysInfo("DBName") + " successfully created.<br>Size of index file - " + result.length + '.<br>' +
                  "Number of entries in index - " + cntentries + '.';
        if (ibu != '')
            msg += "<br>Backed up original index file to " + ibu + '.';
        if (dhtml == 1)
            msg += "<br>Deleted HTML version of active Family DataBase.";
        return msg;
    }
    catch (err) {
        Logging(err + "; problem writing '" + Dir + "/index" + "'.");
        return "Creating new index for " + ProcessDBSysInfo("DBName") + " FAILED. Could not write new index file.";
    }
}

// find first occurrence of multiple values
function findFirstOccurrence(text) {
    const searchTerms = ["Notes -", "Questions -", "Extras -", "Explanations -", "Citations -", "Citation -", "Children:", "Children by "];
    let firstFoundIndex = -1;
    let foundTerm = null;

    for (const term of searchTerms) {
        const currentIndex = text.indexOf(term);
        if (currentIndex !== -1 && (firstFoundIndex === -1 || currentIndex < firstFoundIndex)) {
            firstFoundIndex = currentIndex;
            foundTerm = term;
        }
    }

    if (foundTerm)
        return firstFoundIndex;
    else {
        Logging("*****While creating index, something is wrong. DB not verified? findFirstOccurrence returning null.*****");
        return null;
    }
}

/* move events into Timeline report */
function TimelineEvents (pos, sdate, edate, directives, indname, db, typeind) {
    var curpos = pos;
    var look = 0, pdate = "", udate;

    while (1) {
        if (typeind == 0)
            if (db.substring(curpos, curpos + 8) == "Citation" || db.substring(curpos, curpos + 6) == "Source")
                /* finished with event data */
                break;
        if (typeind == 1 || typeind == 2) {
            if (db.substring(curpos, curpos + 8) == "Children" || db.substring(curpos, curpos + 5) == "Notes" ||
                      db.substring(curpos, curpos + 9) == "Questions" || db.substring(curpos, curpos + 8) == "Citation" ||
                      db.substring(curpos, curpos + 6) == "Source")
                /* finished with Timeline section in family data */
                break;
            if (db.substring(curpos, curpos + 10) == "Timeline -") {
                /* begin looking for pertinent events */
                look = 1;
                /* go to the next line */
                while (db[curpos] != "\n")
                    curpos++;
                curpos++;
            }
        } else
            /* if this isn't familydata then all events within sdate and edate boundaries will be considered */
            look = 1;

        if (look) {
            while (1) {
                /* check for commented line */
                if (db[curpos] == '#') {
                    /* go to the next line */
                    while (db[curpos] != "\n")
                        curpos++;
                    curpos++;
                } else
                    break;
            }
            if (db.substring(curpos, curpos + 11) == "           ") {
                if (db.substring(curpos, curpos + 14) != "              ")  /* check for continuation line (NOT new event) */
                    udate = pdate;   /* date in event is blank, use previous date */
            } else {
                pdate = db.substring(curpos, curpos + 11);   /* save date */
                udate = db.substring(curpos, curpos + 11);
            }
            /* this position could contain c (for circa) or d (for double date/dual date) or - (for BC) et al */
            var specChar = udate[6];
            udate = udate.substring(0,6) + ' ' + udate.substring(7);
            /* sometimes the date is only a year (JS can handle a date that contains only a month & year, but not just a year) */
            if (udate.substring(0,6) === "      ")
                udate = '   Jan' + udate.substring(6);
            var tdate = new Date(udate);
            /* handle years less than 100 */
            if (udate[7] == ' ' && udate[8] == ' ' && udate[9] == ' ')
                tdate.setFullYear(udate[10] * 1);
            else
                if (udate[7] == ' ' && udate[8] == ' ')
                    tdate.setFullYear((udate[9] * 1) + (udate[10] * 1));
            tdate.setHours(0,0,0,0);         /* compare only month, day & year */
            if (db[curpos + 10] != " ")
                var tdateFullYear = db.substring(curpos + 7, curpos + 11);
            var sdateFullYear = sdate.getFullYear();
            var edateFullYear = edate.getFullYear();

            var doIt = 0;
            /* selection criteria is different depending upon BC or AD settings & dates */
            if (directives.SADBC == "SAD" && (specChar != "-" && specChar != "C") && tdate >= sdate && tdate <= edate &&
                                                                   db.substring(curpos, curpos + 14) != "              ")
                doIt = 1;
            if (directives.SADBC == "SBC" && directives.EADBC == "EBC" && (specChar == "-" || specChar == "C") &&
                                                             ((tdateFullYear < sdateFullYear && tdateFullYear > edateFullYear) ||
                                           (tdateFullYear == sdateFullYear && tdate >= sdate && tdateFullYear > edateFullYear) ||
                        (tdateFullYear == sdateFullYear && tdate >= sdate && tdateFullYear == edateFullYear && tdate <= edate) ||
                                             (tdateFullYear < sdateFullYear && tdateFullYear == edateFullYear && tdate <= edate)))
                doIt = 1;
            if (directives.SADBC == "SBC" && directives.EADBC == "EAD" && (specChar == "-" || specChar == "C") &&
                            (tdateFullYear < sdateFullYear || (tdateFullYear == sdateFullYear && tdate >= sdate)))
                doIt = 1;
            if (directives.SADBC == "SBC" && directives.EADBC == "EAD" && (specChar != "-" && specChar != "C") && tdate <= edate &&
                                                                              db.substring(curpos, curpos + 14) != "              ")
                doIt = 1;

            if (doIt) {
                var holdline = "";
                holdline += db.substring(curpos, db.indexOf("\n", curpos));
                var bpos = holdline.indexOf(' ', 11);

                if (typeind == 1 || typeind == 2) {
                    /* check for omissions (only applies to familydata) */
                    if ((directives.OBirths && holdline.indexOf (" born", bpos + 1) != -1) ||
                                  (directives.OBaptisms && holdline.indexOf (" baptize", bpos + 1) != -1) ||
                                  (directives.ODeaths && holdline.indexOf (" die", bpos + 1) != -1) ||
                                  (directives.OMarriages && holdline.indexOf (" marrie", bpos + 1) != -1) ||
                                  (directives.OBurials && holdline.indexOf (" buried", bpos + 1) != -1) ||
                                  (directives.ODeeds && (holdline.indexOf (" sells", bpos + 1) != -1 ||
                                                    holdline.indexOf (" sold", bpos + 1) != -1 || holdline.indexOf (" deed", bpos + 1) != -1 ||
                                                    holdline.indexOf (" purchase", bpos + 1) != -1)) ||
                                  (directives.OResidences && (holdline.indexOf (" living", bpos) != -1 ||
                                                    holdline.indexOf (" lives", bpos) != -1 || holdline.indexOf (" moved", bpos) != -1 ||
                                                    holdline.indexOf (" moves", bpos) != -1)) ||
                                  (directives.IPeople && (holdline.indexOf ("People->", bpos + 1) != -1)) ||
                                  (directives.OOccupations && (holdline.indexOf (" working", bpos + 1) != -1 ||
                                                    holdline.indexOf (" works", bpos + 1) != -1 || holdline.indexOf (" worked", bpos + 1) != -1 ||
                                                    holdline.indexOf (" employed", bpos + 1) != -1))) {
                        /* go to the next line */
                        while (db[curpos] != "\n")
                            curpos++;
                        curpos++;
                        continue;
                    }
                }

                if (((typeind == 1 && directives.ChildID === "") && ((holdline.substring (bpos + 1, bpos + 7) == "living" ||
                           holdline.substring (bpos + 1, bpos + 6) == "lives" || holdline.substring (bpos + 1, bpos + 6) == "moved" ||
                           holdline.substring (bpos + 1, bpos + 6) == "moves") || holdline.indexOf(indname, 10) != -1)) ||
                           /* doing individual who is a head of a family; move every event in family group which contains (or is assumed
                              to contain) the individual's name and which falls within dates */

                           ((typeind == 1 && directives.ChildID != "") && holdline.indexOf("child #" + childnum, 10) != -1) ||
                           /* doing individual who is NOT a head of a family; move every event in family group which contains
                              the individual's name and which falls within dates */

                           (typeind == 2) ||
                           /* doing entire family */

                           (typeind == 0)) {
                           /* non-family, doing entire data */

                    if (holdline.substring(0, 11) == "           ")
                        holdline = pdate + holdline.substring(11);     /* if date is blank, fill it in */

                    /* add this event into Report */
                    var tarr = tdata.split("\n").filter(r => r !== '');
                    var i;

                    for (i = 0; i < tarr.length; i++) {
                        var tjdate = tarr[i].substring(0, 11);
                        /* this position could contain a c (for circa) or a d (for double date/dual date) */
                        tjdate = tjdate.substring(0,6) + ' ' + tjdate.substring(7);
                        /* sometimes the date is only a year (JS can handle a date that contains only a month & year, but not just a year) */
                        if (tjdate.substring(0, 6) === "      ")
                            tjdate = '   Jan' + tjdate.substring(6);
                        var tkdate = new Date(tjdate);
                        tkdate.setHours(0,0,0,0);         /* compare only month, day & year */
                        if (tdate > tkdate)
                            continue;
                        else {
                            /* make room for new event */
                            for (var j = tarr.length; j > i; j--)
                                tarr[j] = tarr[j - 1];
                            break;
                        }
                    }
                    tarr[i] = holdline.replace(/ \[.*?\]/g, '').trimEnd();    // remove Citation references

                    /* check for continuation lines */
                    while (1) {
                        /* go to the next line */
                        while (db[curpos] != "\n")
                            curpos++;
                        curpos++;

                        if (db.substring(curpos, curpos + 14) == "              ")
                            /* lines need to be combined for sorting */
                            tarr[i] += db.substring(curpos + 13, db.indexOf("\n", curpos + 13)).replace(/ \[.*?\]/g, '').trimEnd();
                        else
                            break;
                    }

                    tdata = tarr.join("\n");
                }
                else {
                    /* go to the next line */
                    while (db[curpos] != "\n")
                        curpos++;
                    curpos++;
                }
            }
            else {
                /* go to the next line */
                while (db[curpos] != "\n")
                    curpos++;
                curpos++;
            }
            if (db[curpos] == "\n" && typeind != 0)
                /* two consecutive EOLs in familydata, end of event data */
                break;
        }
        else {
            curpos++;
        }
    }
}

/* move events into On This Day report */
function OTDEvents (ddmmm, directives, db, typeind) {
    var curpos = 0, pdate;

    while (1) {
        curpos = db.indexOf("\n" + ddmmm, curpos);
        if (curpos == -1)
            /* finished with the current event data */
            break;
        curpos++;         /* first position of matching line */

        /* hit a match */
        pdate = db.substring(curpos, curpos + 11);   /* save event date */
        OTDtevnts[cntevt] = db.substring(curpos, db.indexOf("\n", curpos)).replace(/ \[.*?\]/g, '').trimEnd();   // remove Citation references

        /* check for continuation lines */
        while (1) {
            /* go to the next line */
            while (db[curpos] != "\n") {
                curpos++;
            }
            curpos++;

            if (db.substring(curpos, curpos + 14) == "              ") {
                /* hit continuation line; lines need to be combined for sorting */
                OTDtevnts[cntevt] += db.substring(curpos + 13, db.indexOf("\n", curpos + 13)).replace(/ \[.*?\]/g, '').trimEnd();
                hitcont = 1;
            } else {
                /* check for new event with blank date; in this case, substitute date from previous event */
                if (db.substring(curpos, curpos + 11) == "           ")
                    db = db.substring(0, curpos) + pdate + db.substring(curpos + 11);
                curpos--;
                break;
            }
        }
        OTDtevnts[cntevt] += "\n";

        /* check for omissions (only applies to familydata) */
        if (typeind == 1) {
            if ((directives.OBirths && OTDtevnts[cntevt].indexOf (" born") != -1) ||
                        (directives.OBaptisms && OTDtevnts[cntevt].indexOf (" baptize") != -1) ||
                        (directives.ODeaths && OTDtevnts[cntevt].indexOf (" die") != -1) ||
                        (directives.OMarriages && OTDtevnts[cntevt].indexOf (" marrie") != -1) ||
                        (directives.OBurials && OTDtevnts[cntevt].indexOf (" buried") != -1) ||
                        (directives.ODeeds && (OTDtevnts[cntevt].indexOf (" sells") != -1 ||
                         OTDtevnts[cntevt].indexOf (" sold") != -1 || OTDtevnts[cntevt].indexOf (" deed") != -1 ||
                         OTDtevnts[cntevt].indexOf (" purchase") != -1)) ||
                        (directives.OResidences && (OTDtevnts[cntevt].indexOf (" living") != -1 ||
                         OTDtevnts[cntevt].indexOf (" lives") != -1 || OTDtevnts[cntevt].indexOf (" moved") != -1 ||
                         OTDtevnts[cntevt].indexOf (" moves") != -1)) ||
                        (directives.IPeople && (OTDtevnts[cntevt].indexOf ("People->") != -1)) ||
                        (directives.OOccupations && (OTDtevnts[cntevt].indexOf (" working") != -1 ||
                         OTDtevnts[cntevt].indexOf (" works") != -1 || OTDtevnts[cntevt].indexOf (" worked") != -1 ||
                         OTDtevnts[cntevt].indexOf (" employed") != -1))) {
                OTDtevnts[cntevt] = "";
            } else
                cntevt++;
        } else
            cntevt++;
    }
}

/* determine the section of the family group which currentloc resides within */
function DetermineSection (currentloc) {
    const Sections = [];
    var m, i, si, familygroup, tf, t2f, newloc;

    /*
       Sections[0] - Header
       Sections[1] - Timeline
       Sections[2] - Notes
       Sections[3] - Questions
       Sections[4] - Explanations
       Sections[5] - Extras
       Sections[6] - Children
       Sections[7] - Children by
       Sections[8] - Source
       Sections[9] - Citation
       Sections[10] - Sources
       Sections[11] - Citations
       Sections[12] - Further Research
    */

    /* extract family group */
    tf = familydata.lastIndexOf ("\n\n\n", currentloc);
    t2f = familydata.indexOf ("\n\n\n", tf + 3);
    familygroup = familydata.substring (tf, t2f - 1);
    newloc = currentloc - tf;       /* new location in extracted family group */

    Sections[0] = familygroup.lastIndexOf ("\n\n\n", newloc);
    Sections[1] = familygroup.lastIndexOf ("Timeline -" + "\n", newloc);
    Sections[2] = familygroup.lastIndexOf ("Notes -" + "\n", newloc);
    Sections[3] = familygroup.lastIndexOf ("Questions -" + "\n", newloc);
    Sections[4] = familygroup.lastIndexOf ("Explanations -" + "\n", newloc);
    Sections[5] = familygroup.lastIndexOf ("Extras -" + "\n", newloc);
    Sections[6] = familygroup.lastIndexOf ("Children:" + "\n", newloc);
    Sections[7] = familygroup.lastIndexOf ("Children by ", newloc);
    Sections[8] = familygroup.lastIndexOf ("Source -" + "\n", newloc);
    Sections[9] = familygroup.lastIndexOf ("Citation -" + "\n", newloc);
    Sections[10] = familygroup.lastIndexOf ("Sources -" + "\n", newloc);
    Sections[11] = familygroup.lastIndexOf ("Citations -" + "\n", newloc);
    Sections[12] = familygroup.lastIndexOf ("Further Research -" + "\n", newloc);

    /* find largest location (which will be closest to currentloc/newloc) */
    for (m = i = 0; i != Sections.length; i++) {
        if (Sections[i] > m) {
            m = Sections[i];
            si = i;                /* save identifier */
        }
    }

    switch (si) {
        case 0:
            return "Header";
            break;
        case 1:
            return "Timeline";
            break;
        case 2:
            return "Notes";
            break;
        case 3:
            return "Questions";
            break;
        case 4:
            return "Explanations";
            break;
        case 5:
            return "Extras";
            break;
        case 6:
        case 7:
            return "Children";
            break;
        case 8:
        case 9:
        case 10:
        case 11:
            return "Citations";
            break;
        case 12:
            return "FurtherResearch";
            break;
        default:
            return -1;
    }
}

/* look for match on year for born or died */
function Look4Match (factors, loc1, loc2) {
    var i, familygroup, name, tf, t2f, t3f;

    /* extract family group */
    tf = familydata.lastIndexOf ("\n\n\n", loc1);
    t2f = familydata.indexOf ("\n\n\n", tf + 3);
    familygroup = familydata.substring (tf, t2f + 3);

    if (loc1 == loc2)
        /* there's no name to look for; look for "child" */
        name = "child";
    else
        name = familydata.substring (loc1, loc2);

    if (factors.year)
        for (i = 3; i < familygroup.length; i++) {
            tf = familygroup.indexOf (name, i);
            if (tf == -1)
                return 0;
            for (t2f = tf; familygroup[t2f] != "\n"; t2f++)
                if (familygroup.substring (t2f, t2f + 4) == "born" || familygroup.substring (t2f, t2f + 4) == "died") {
                    t3f = familygroup.lastIndexOf ("\n", t2f);
                    t3f += 8;
                    if (familygroup.substring (t3f, t3f + 4) == factors.year)
                        return 1;
                }
        }
    else
        return 1;   // no year to search for

    return 0;       // no match
}

/* found a match on name in the Children section; find last name by:
   1.  if the matching child has it's own family group then the last name can be obtained there
   2.  if a sibling of the matching child has it's own family group then the last name can be obtained there
       (but need to check if it's a half-sibling)
   3.  if the last name to match upon occurs in the current family group then mark the match as a possible */
function ChildrenMatch (fnd, pdata, len) {
    var hid, t2f, t3f, tmatch = 0, childfamloc, eolloc, hfamgrp;

    tf = familydata.lastIndexOf ("\n", fnd);
    if (familydata[tf + 1] >= '0' && familydata[tf + 1] <= '9') {
        /* matching child has it's own family group */
        t2f = familydata.indexOf (" ", tf + 1);
        hid = familydata.substring(tf + 1, t2f);
        childfamloc = familydata.indexOf ("\n\n\n" + hid);
        if (childfamloc == -1) {
            /* can't find child's family group */
            ;        /* do nothing, look for possible lastname match in a sibling's family group or current family group next */
        }
        else {
            childfamloc += 3;
            eolloc = familydata.indexOf ("\n", childfamloc);
            t2f = familydata.lastIndexOf (" ", eolloc);
            if (pdata.lastname == familydata.substring (t2f + 1, eolloc)) {
                t3f = familydata.lastIndexOf ("  ", eolloc);     /* go to beginning of name */
                /* matched on name; look for match on any other factors which are present */
                if (Look4Match (pdata, t3f + 2, eolloc))
                    tmatch = 1;
            }
            else
                return -1;
        }
    }

    if (!tmatch) {
    /* look for a sibling who has his or her own Family Group */
        tf = familydata.lastIndexOf ("\n" + "Children", fnd);
        for (t2f = tf; t2f < familydata.length; t2f++) {
            if (familydata[t2f] == "\n" && familydata[t2f + 1] == "\n" && familydata[t2f + 1] == "\n")
                /* end of Family Group */
                break;
            if (familydata[t2f] >= '0' && familydata[t2f] <= '9' && familydata[t2f - 1] == "\n") {
                /* found a sibling with his or her own Family Group */ 
                t3f = familydata.indexOf (" ", t2f + 1);
                hid = familydata.substring(t2f, t3f);
                childfamloc = familydata.indexOf ("\n\n\n" + hid);
                if (childfamloc == -1) {
                    /* can't find this sibling's family group; look for another sibling with it's own Family group */
                    t2f = t3f;
                    continue;
                } else {
                    var t4f;

                    childfamloc += 3;
                    eolloc = familydata.indexOf ("\n", childfamloc);
                    t3f = familydata.lastIndexOf (" ", eolloc);
                    if (pdata.lastname == familydata.substring (t3f + 1, eolloc)) {
                        t4f = familydata.lastIndexOf ("  ", eolloc);     /* go to beginning of name */
                        /* matched on name; look for match on any other factors which are present */
                        if (Look4Match (pdata, t4f + 2, eolloc))
                            tmatch = 1;
                    } else
                        return -1;
                }
            }
        }
    }

    if (!tmatch) {
        tf = familydata.lastIndexOf ("\n\n\n", fnd);
        tf += 3;
        for (t2f = tf; t2f < familydata.length; t2f++) {
            if (familydata.substring (t2f, t2f + 10) == "Citation -" || familydata.substring (t2f, t2f + 8) == "Source -" ||
                     familydata.substring (t2f, t2f + 11) == "Citations -" || familydata.substring (t2f, t2f + 9) == "Sources -") {
                hfamgrp = familydata.substring (tf, t2f - 1);
                break;
            }
        }
        t3f = hfamgrp.indexOf (pdata.lastname);
        if (t3f == -1)
            return -1;
        else
            /* matched on name; look for match on any other factors which are present */
            if (Look4Match (pdata, fnd, len))
                return 2;
            else
                return -1;
    }
    return 1;
}

/* create directory/folder if it doesn't already exist */
function dirExist(dir) {
    var res = fs.existsSync(path.normalize(dir));
    if (!res) {
        try {
            fs.mkdirSync(path.normalize(dir));
        }
        catch (err) {
            Logging(err + "; problem creating directory/folder '" + dir + "'.");
            return -1;
        }
        return 1;
    } else
        return (0);
}

/* update DBSysInfo */
function UpdateDBSysInfo (what, newvalue) {
    if (what == "DBStatus") {
        /* update DBStatus of active DB */
        var activepos = DBSysInfo.indexOf("DBActive = \"yes\"", 0);
        var statuspos = DBSysInfo.indexOf("DBStatus = \"", activepos);
        statuspos += 12;
        DBSysInfo = DBSysInfo.substring(0, statuspos) + newvalue + DBSysInfo.substring(statuspos + 1);   /* DBStatus is always 1 position */
    }
}

/* create a tableofcontents file */
function TOC (which) {
    /* create tableofcontents file */
    /* which is one of:  HTML, PlainText, Other, root */
    var dir, target, tob;
    var dbname = ProcessDBSysInfo("DBName");
    if (which != "HTML") {
        tob = "Table of Contents of " + which + " directory/folder of " + dbname + " Family DataBase" + os.EOL + os.EOL +
              "File Name                Description" + os.EOL + os.EOL + "tableofcontents           Table of Contents" + os.EOL;
    } else {
        tob = '<!doctype html> <html lang="en"> <HEAD> <meta charset="utf-8"/> <link rel="shortcut icon" href="Include/favicon.ico"> ' +
              '<title> Table of Contents for HTML version of ' + dbname + ' </title> ' + '</head> ' +
              '<body style="margin-left:15%;margin-right:15%;line-height:1.4;font-size: 100%" ' +
              'bgcolor="#ffffff"> <pre> <center> <p> <h1>' + dbname + ' </h1> <p> </center><hr> <p>'
        tob += "Table of Contents of " + which + " directory/folder of " + dbname + " Family DataBase" + os.EOL + os.EOL +
               "File Name                Description" + os.EOL + os.EOL +
               '<a href="tableofcontents.html">tableofcontents.html</a>     Table of Contents' + os.EOL;
    }

    dir = path.join(ProcessDBSysInfo("DBLocation"), "/");
    if (which != "root")
        dir += which;

    /* enumerate files & dirs in directory/folder */
    fs.readdirSync(dir).forEach(file => {
        if (file.substring(0,4) != "body" && file.substring(0,5) != "index")
            tob += file;
        if (file == "HTML") {
            tob += "          (directory/folder) contains an optional HTML (Web) version" + os.EOL;
            tob += "                of this Family DataBase" + os.EOL;
        }
        if (file == "Images") {
            tob += "          (directory/folder) contains graphical Source files," + os.EOL;
            tob += "                photos and other graphical files regarding people in" + os.EOL;
            tob += "                the DataBase" + os.EOL;
        }
        if (file == "Other") {
            tob += "          (directory/folder) contains info describing the Family DataBase" + os.EOL;
            tob += "                and other miscellaneous, optional files" + os.EOL;
        }
        if (file == "PlainText") {
            tob += "          (directory/folder) contains info describing the DataBase" + os.EOL;
            tob += "                (directory/folder) contains the DataBase in plain text" + os.EOL;
            tob += "                and other files which are optional" + os.EOL;
        }
        if (file == "Reference") {
            tob += "          (directory/folder) contains plain text Citation files" + os.EOL;
        }
        if (file == "UnsureIfRelated") {
            tob += "          (directory/folder) various people who may or may not be related" + os.EOL;
        }
        if (file.substring(0,5) == "index") {
            if (which == "HTML")
                tob += '<a href="' + file + '">' + file + '</a>';
            else
                tob += file;
            tob += "               every-name index" + os.EOL;
        }
        if (file.substring(0,4) == "body") {
            if (which == "HTML")
                tob += '<a href="' + file + '">' + file + '</a>';
            else
                tob += file;
            tob += "               Family History" + os.EOL;
        }
        if (file == "Bibliography.txt") {
            tob += "          list of reference material used in this Family DataBase" + os.EOL;
        }
        if (file == "Dedication.txt") {
            tob += "          dedication" + os.EOL;
        }
        if (file == "Founders.txt") {
            tob += "          list of people in this Family DataBase who founded something" + os.EOL;
        }
        if (file == "Introduction.txt") {
            tob += "          introduction to this Family DataBase" + os.EOL;
        }
        if (file == "Notes.txt") {
            tob += "          miscellaneous notes pertaining to this Family DataBase" + os.EOL;
        }
        if (file == "README.txt") {
            tob += "          basic info pertaining to this Family DataBase" + os.EOL;
        }
        if (file == "ResearchToDo.txt") {
            tob += "          notes pertaining to additional research which" + os.EOL;
            tob += "                could/should be done regarding this Family DataBase" + os.EOL;
        }
        if (file == "SurnameRecap.txt") {
            tob += "          general notes with regard to some surnames appearing in" + os.EOL;
            tob += "                this Family DataBase" + os.EOL;
        }
        if (file == "DBinfo.txt") {
            tob += "          info describing this Family DataBase (used by MELGenUtils)" + os.EOL;
        }
        if (file == "FamilyObscurities.txt") {
            tob += "          obscure info pertaining to some people and/or families" + os.EOL;
            tob += "                appearing in this Family DataBase" + os.EOL;
        }
        if (file == "DevHistory.txt") {
            tob += "          development history regarding this Family DataBase" + os.EOL;
        }
        if (file == "NotablePeople.txt") {
            tob += "          info with regard to some notable people appearing in" + os.EOL;
            tob += "                this Family DataBase" + os.EOL;
        }
        if (file == "Preface.txt") {
            tob += "          preface to this Family DataBase" + os.EOL;
        }
        if (file == "ReleaseNotes.txt") {
            tob += "          notes pertinent to the current release of this Family DataBase" + os.EOL;
        }
        if (file == "Statistics.txt") {
            tob += "          some statistics regarding this Family DataBase" + os.EOL;
        }
        if (file == "UsersGuide.txt") {
            tob += "          a guide for using this Family DataBase" + os.EOL;
        }
    })

    if (which != "root") {
        target = path.join(dir, "tableofcontents");
        if (which == "HTML") {
            tob += "</pre> </body> </html>";
            target += ".html";
        }
    } else
        target = path.join(dir, "tableofcontents");
    try {
        fs.writeFileSync(target, tob);
        Logging("Created '" + target + "'.");
    }
    catch (err) {
        Logging(err + "; problem writing '" + target + "'.");
    }
}

/* log messages */
function Logging (msg) {
    var date = new Date(), day, month, amonth, hours, minutes, seconds;
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    day = date.getDate();
    month = date.getMonth() + 1;
    year = date.getFullYear();
    if (day < 10)
        day = ' ' + day;
    amonth = months[month - 1];
	var current_date = day + ' ' + amonth + ' ' + date.getFullYear();

    hours = date.getHours();
    minutes = date.getMinutes();
    seconds = date.getSeconds();
    if (hours < 10)
        hours = '0' + hours;
    if (minutes < 10)
        minutes = '0' + minutes;
    if (seconds < 10)
        seconds = '0' + seconds;
    var current_time = hours + ":" + minutes + ":" + seconds;

    /* clear log when it gets over 200MB */
    if (log.length > 200000000) {
        log = "";
        log += current_date + ', ' + current_time + "  " + "Log reached its maximum size of 200MB; cleared log; begin again." + os.EOL;
    }

    log += current_date + ', ' + current_time + "  " + msg + os.EOL;
}

/* create (or add to) contents for DBinfo.txt file */
function createDBinfo (ged, DBname) {
    var contents = "", head, retitems, version;

    if (ged != -1 && ged != -2) {
        /* get the HEAD record */
        retitems = extract0Rec (ged, '', "HEAD", 0);
        head = retitems.str;
    }

    if (ged != -2) {
        contents += "# a pound sign (#) in column 1 of any line identifies that line as a comment" + os.EOL;
        contents += "# all fields except DBName, DBVersion and DBDescription may have multiple values; separate multiple values using " +
                    "a semi-colon (;)" + os.EOL;
        contents += "# enclose a set of values within quotes \(\"\)" + os.EOL;
        contents += "# do not use quotes \(\"\) within any field value" + os.EOL;
        contents += "# all field names and values are optional" + os.EOL;
        contents += "# a null field value can be shown as \"\"" + os.EOL;
        contents += "# all field value lengths are unlimited" + os.EOL + os.EOL;
        contents += "#" + os.EOL + "# provided fields" + os.EOL + "#" + os.EOL;
        contents += "DBName = \"" + DBname + "\"" + os.EOL;
        contents += "# if version number not provided, use date in form yyyymmdd" + os.EOL;
        contents += "DBVersion = \"";
    }

    if (ged != -1 && ged != -2) {
        /* for version # use [1] VERS in HEAD, or [2] DATE in HEAD, or [3] today's date */
        retitems = extractField (head, 1, "VERS", 0);
        version = retitems.str;
        if (version == "undefined") {
            retitems = extractField (head, 1, "DATE", 0);
            version = retitems.str;
            if (version == "undefined")
                version = yyyymmdd("today");
            else
                version = yyyymmdd(version);
        }
    }
    if (ged == -1)
        version = yyyymmdd("today");

    if (ged != -2) {
        contents += version + "\"" + os.EOL;
        contents += "# for description, at a minimum itemize main surnames and main geographical areas" + os.EOL;
        contents += "DBDescription = \"";
    }

    if (ged != -1 && ged != -2) {
        /* use NOTE for description if it exists */
        retitems = extractField (head, 1, "NOTE", 0);
        if (retitems.str != "undefined")
            contents += retitems.str;
    }

    if (ged != -2) {
        contents += "\"" + os.EOL;
        contents += "DBCreator = \"\"" + os.EOL;
        contents += "DBCreatorAddr = \"\"" + os.EOL;
        contents += "DBCreatorEmail = \"\"" + os.EOL;
        contents += "DBCreatorPhone = \"\"" + os.EOL;
        contents += "DBCreatorURL = \"\"" + os.EOL;
        contents += "DBCreatorLiveChat = \"\"" + os.EOL;
        contents += "DBMessageBoard = \"\"" + os.EOL;
        contents += "DBBlog = \"\"" + os.EOL;
    }
    contents += "#" + os.EOL + "# generated fields; editing will risk making DataBase invisible (or even unusable) to MELGenUtils" + os.EOL +
                "#" + os.EOL;
    contents += "DBInstallationDate = \"";
    contents += yyyymmdd("today") + "\"" + os.EOL;;
    contents += "DBLocation = \"";
    contents += "DBs/" + DBname;
    contents += "\"" + os.EOL;
    contents += "DBCitation = \"";

    if (ged != -1 && ged != -2) {
        /* use SOUR for Citation if it exists */
        retitems = extractField (head, 1, "SOUR", 0);
        if (retitems.str != "undefined")
            contents += "From a Gedcom created by " + retitems.str.trim();
        else
            contents += "From a Gedcom created by unknown";
    } else
        contents += "From plain text files created by the user.";

    contents += "\"" + os.EOL;

    return contents;
}

/* return date in yyyymmdd format */
function yyyymmdd(idte) {
    var now = "", y, m, d;

    if (idte == "today")
        now = new Date();
    else
        now = new Date(idte);
    y = now.getFullYear();
    m = now.getMonth() + 1;
    d = now.getDate();
    return '' + y + (m < 10 ? '0' : '') + m + (d < 10 ? '0' : '') + d;
}

/* extract a 0 record from a Gedcom */
function extract0Rec (rec, key, label, start) {
    var b, e;

    b = rec.indexOf("\n" + "0 " + key.trim() + " " + label, start);
    if (b != -1)
        e = rec.indexOf("\n" + '0 ', b + 1);
    else
        e = -1;
    if (e == -1)
        e = rec.length;
    if (b == -1)
        return { str: "", e: e };
    else
        return { str: rec.toString().substring(b + 1, e + 1), e: e };
}

/* extract a field (i.e., data appearing on 1 line only) in a Gedcom */
function extractField (rec, level, label, start) {
    var b, e;

    b = rec.indexOf(level + " " + label, start);
    e = rec.indexOf("\n", b + 7);
    if (b == -1 || e == -1)
        if (label == "GIVN") {
            /* extract given name from NAME record */
            b = rec.indexOf("1" + " " + "NAME", start);
            if (b == -1)
                return { str: "------", e: e };
            else {
                e = rec.indexOf("/", b);
                if (e == -1)
                    return { str: "------", e: e };
                else
                    return { str: rec.substring(b + 7, rec.indexOf("/", b + 7) - 1) + " ", e: e };
            }
        } else
            if (label == "SURN") {
                /* extract surname from NAME record */
                b = rec.indexOf("1" + " " + "NAME", start);
                if (b == -1)
                    return { str: "------", e: e };
                else {
                    b = rec.indexOf("/", b);
                    if (b == -1)
                        return { str: "------", e: e };
                    else
                        return { str: rec.substring(b + 1, rec.indexOf("/", b + 1)) + " ", e: e };
                }
            } else
                return { str: "undefined", e: e };
    else
        return { str: rec.substring(b + 7, e) + " ", e: e };
}

/* convert number into Roman Numeral
   from https://blog.stevenlevithan.com/archives/javascript-roman-numeral-converter */
function romanize (num) {
    if (isNaN(num))
        return NaN;
    var digits = String(+num).split(""),
        key = ["","c","cc","ccc","cd","d","dc","dcc","dccc","cm",
               "","x","xx","xxx","xl","l","lx","lxx","lxxx","xc",
               "","i","ii","iii","iv","v","vi","vii","viii","ix"],
        roman = "",
        i = 3;
    while (i--)
        roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    return Array(+digits.join("") + 1).join("m") + roman;
}

/* return either Father's ID or Mother's ID in Gedcom */
function getParentID (ged, irec, which) {
    var famsect, retitems, id;

    famsect = findFam (ged, irec, "FAMC");
    if (famsect == -1 || !famsect)
        /* either FAMC doesn't exist in the INDI record or the FAM 0 record doesn't exist in the Gedcom */
        return 0;
    
    retitems = extractField (famsect, 1, which, 0);
    id = retitems.str;
    if (id == "undefined")
        return 0;
    return id;
}

/* return either Father's name or Mother's name in a Gedcom */
function getParentName (ged, irec, which) {
    var famsect, retitems, Gretitems, Lretitems, id, pirec, name;

    famsect = findFam (ged, irec, "FAMC");
    if (famsect == -1 || !famsect)
        /* either FAMC doesn't exist in the INDI record or the FAM 0 record doesn't exist in the Gedcom */
        return "";

    retitems = extractField (famsect, 1, which, 0);
    id = retitems.str;
    if (id == "undefined")
        return "";

    /* get INDI record for requested parent */
    retitems = extract0Rec (ged, id, "INDI", 0);
    pirec = retitems.str;
    Gretitems = extractField (pirec, 2, "GIVN", 0);
    if (Gretitems.str.trim() == '')
        name = "------";
    else
        name = Gretitems.str.trim();
    Lretitems = extractField (pirec, 2, "SURN", 0);
    if (Lretitems.str.trim() == '')
        name += " " + "------";
    else
        name += " " + Lretitems.str.trim();

    if (Gretitems.str.trim() == '' && Lretitems.str.trim() == '')
        return "name unknown";
    else
        return name;
}

/* get FAMC or FAMS record for an individual in a Gedcom */
function findFam (ged, irec, label) {
    var b, e, f, famid, famsect, retitems;

    /* get FAM ID */
    retitems = extractField (irec, 1, label, 0);
    famid = retitems.str.trim();
    if (famid == "undefined")
        return -1;
    /* extract FAM record */
    retitems = extract0Rec (ged, famid + " ", "FAM", 0)
    famsect = retitems.str;
    if (famsect == -1)
        return 0;
    else
        return famsect;
}

/* in a Gedcom, check if an INDI has children */
function Check4Children (ged, irec) {
    var b, e, f, famid, famsect, retitems;

    /* get FAM ID */
    retitems = extractField (irec, 1, "FAMS", 0);
    famid = retitems.str;
    if (famid == "undefined")
        return 0;
    /*extract FAM record */
    retitems = extract0Rec (ged, famid, "FAM", 0)
    famsect = retitems.str;

    f = famsect.indexOf("1 CHIL @");
    if (f == -1)
        return 0;
    else
        return 1;
}

/* extract a Gedcom section */
function extractSect (rec, level, label) {
    var b, e;

    b = rec.indexOf(level + ' ' + label);
    if (b == -1) 
        return "";
    for (e = b + 1; e < rec.length; e++)
        if (rec[e] == "\n" && parseInt(rec[e + 1]) <= parseInt(level) && rec[e + 2] == " ")
            break;
    return rec.substring(b, e + 1);
}

/* given an ID, return full name */
function GetFullNameFromID (ged, id) {
    var irec, Gretitems, Lretitems;

    /* get INDI record for requested ID */
    retitems = extract0Rec (ged, "@" + id + "@", "INDI", 0);
    irec = retitems.str;
    Gretitems = extractField (irec, 2, "GIVN", 0);
    if (Gretitems.str == '')
        name = "------";
    else
        name = Gretitems.str.trim();
    Lretitems = extractField (irec, 2, "SURN", 0);
    if (Lretitems.str == '')
        name += " " + "------";
    else
        name += " " + Lretitems.str.trim();

    if (Gretitems.str == '' && Lretitems.str == '')
        return "name unknown";
    else
        return name;
}

/* check permissions of files */
function GoThruDirectory(dir, sw) {
    /* sw = 0, checking db-in directory; sw = 1, checking the DB output directory */
    var cntf = 0;
    fs.readdirSync(path.normalize(dir)).forEach(file => {
        if (sw)
            cntf++;
        const Absolute = path.join(dir, file);
        if (fs.statSync(Absolute).isDirectory()) {
            if (!(fs.statSync(Absolute).isSymbolicLink())) {
                try {
                    fs.accessSync(Absolute, fs.constants.R_OK);
                    GoThruDirectory(Absolute, sw);
                } catch (err) {
                    errors += "Folder/directory permissions won't allow the contents of '" + Absolute + "' to be read/copied.<br> <br>";
                }
            }
        } else {
            try {
                fs.accessSync(Absolute, fs.constants.R_OK);
            } catch (err) {
                errors += "File permissions won't allow '" + Absolute + "' to be read/copied.<br> <br>";
            }
        }
    })
    if (sw)
        return (cntf);
}

/* pre-check for setting focus ID in active DB */
async function PreSetFocusID (ID) {
    var famgrp, x, name, date, ret, SFmsgs = '';

    ReadFamilyDB();
    if (ProcessDBSysInfo("DBStatus") != 1 && ProcessDBSysInfo("DBStatus") != 3)
        return "ERRORS The active Family DataBase is not verified.<br>The DataBase must be successfully verified before the Focus ID " +
               "can be changed.<br> <br>";

    ret = familydata.indexOf("\n\n" + ID + "  ");
    if (ret == -1)
        return "ERRORS ID '" + ID + "' not found in active Family DataBase.<br> <br>";
    else {
        famgrp = familydata.substring(ret + 3, familydata.indexOf("\n\n\n", ret + 3));
        name = famgrp.substring(famgrp.indexOf("  ") + 2, famgrp.indexOf("\n"));
        SFmsgs = name + ", the child of ";
        ret = famgrp.indexOf("Father -") + 8;
        for (x = 0; famgrp[ret + x] != "\n"; x++)
            if (famgrp[ret + x].toUpperCase() != famgrp[ret + x].toLowerCase())
                break;
        SFmsgs += famgrp.substring(ret + x, famgrp.indexOf("\n", ret + x)) + " and ";
        ret = famgrp.indexOf("Mother -") + 8;
        for (x = 0; famgrp[ret + x] != "\n"; x++)
            if (famgrp[ret + x].toUpperCase() != famgrp[ret + x].toLowerCase())
                break;
        SFmsgs += famgrp.substring(ret + x, famgrp.indexOf("\n", ret + x));
        ret = famgrp.indexOf(name + " born");
        if (ret != -1) {
            while (1) {
                ret = famgrp.lastIndexOf("\n", ret);
                if (famgrp[ret + 1] == " " || (famgrp[ret + 1] >= '0' && famgrp[ret + 1] <= '9')) {
                    date = famgrp.substring(ret + 1, ret + 12).trim();
                    if (date != "")
                        break;
                }
            }
            SFmsgs += ",<br>born " + date;
        }
        ret = famgrp.indexOf(name + " died");
        if (ret != -1) {
            while (1) {
                ret = famgrp.lastIndexOf("\n", ret);
                if (famgrp[ret + 1] == " " || (famgrp[ret + 1] >= '0' && famgrp[ret + 1] <= '9')) {
                    date = famgrp.substring(ret + 1, ret + 12).trim();
                    if (date != "")
                        break;
                }
            }
            SFmsgs += ", died " + date;
        }
        SFmsgs += ".<br> <br>"
    }
    return SFmsgs;
}

function DoSetFocusID (ID) {
    if (ProcessDBSysInfo("ID") == ID)
        return -1;
    else {
        /* update Focus ID in active Family DataBase */
        var activepos = DBSysInfo.indexOf("DBActive = \"yes\"", 0);
        var idpos = DBSysInfo.indexOf("DBUserID = \"", activepos);
        if (activepos === -1 || idpos === -1)
            return -1;
        idpos += 12;
        DBSysInfo = DBSysInfo.substring(0, idpos) + ID + DBSysInfo.substring(DBSysInfo.indexOf("\"", idpos));
        try {
            /* write MELGenUtilsInfo.txt */
            fs.writeFileSync('MELGenUtilsInfo.txt', DBSysInfo);
            Logging("Change in Focus ID, MELGenUtilsInfo.txt written.");
        }
        catch (err) {
            Logging(err + "; problem writing 'MELGenUtilsInfo.txt'.");
        }
    }
}

// Helper function to identify common name prepositions
const isNamePreposition = (word) => {
    const prepositions = ["van", "von", "der", "de", "den", "la", "le"];
    return prepositions.includes(word.toLowerCase());
}

// Helper function to check if a word starts with a capital letter
const startsWithCapital = (word) => { 
    return word.length > 0 && word[0] >= 'A' && word[0] <= 'Z';
}

function findProperName(event) {
    const words = event.split(/[, ;]/).slice(0, 6); // split by space, comma or semi-colon, limit to a maximum of 6 words for the name.
    let nameParts = [];

    if (words.length > 0) {
        const firstWord = words[0];
        // The first word must be a valid name start (capitalized or "------")
        if (startsWithCapital(firstWord) || firstWord === "------") {
            nameParts.push(firstWord);

            // Iterate through subsequent words to build the full name
            for (let i = 1; i < words.length; i++) {
                const currentWord = words[i];

                if (currentWord === "------") {
                    // If "------" is encountered after the first word, it's always the last part of the name.
                    nameParts.push(currentWord);
                    break; // Stop processing further words, as the name is complete.
                } else
                    if (isNamePreposition(currentWord))
                        // If it's a preposition (like "van"), add it. We expect a capitalized word to follow.
                        nameParts.push(currentWord);
                    else
                        if (startsWithCapital(currentWord))
                            // If it's a capitalized word (e.g., a middle name or the main part of a last name like "Johnson")
                            nameParts.push(currentWord);
                        else
                            // If the word doesn't fit any name pattern, it signifies the end of the name.
                            break;
            }
        }
    }
    return nameParts;
}

function ChkLinks () {
    const statusCodeDescriptions = {
        100: "OK, continue",
        101: "OK, switching protocols",
        102: "OK, processing deprecated",
        103: "OK, early hints",
        200: "OK, success",
        201: "OK, created",
        202: "OK, accepted",
        203: "OK, non-authoritative information",
        204: "OK, no content",
        205: "OK, reset content",
        206: "OK, partial content",
        207: "OK, multi-status",
        208: "OK, already reported",
        226: "OK, IM used",
        300: "server reachable, multiple choices (meaning client input is expected)",
        301: "server reachable, page (specific address) moved permanently",
        302: "server reachable, found (page content may be changing)",
        303: "server reachable, see other",
        304: "server reachable, not modified",
        305: "server reachable, use proxy deprecated",
        306: "server reachable, unused",
        307: "server reachable, temporary redirect",
        308: "server reachable, permanent redirect (page moved)",
        400: "server reachable, bad request",
        401: "server reachable, client unauthenticated",
        402: "server reachable, payment required",
        403: "server reachable, client is unauthorized (perhaps a login & password is needed)",
        404: "server reachable, the specific page (address) is not found",
        405: "server reachable, method not allowed",
        406: "server reachable, not acceptable",
        407: "server reachable, proxy authentication required",
        408: "server reachable, request timeout",
        409: "server reachable, conflict",
        410: "server reachable, page gone/removed/deleted",
        411: "server reachable, length required",
        412: "server reachable, precondition failed",
        413: "server reachable, content too large",
        414: "server reachable, URI too long",
        415: "server reachable, unsupported media type",
        416: "server reachable, range not satisfiable",
        417: "server reachable, expectation failed",
        418: "server reachable, I'm a teapot",
        421: "server reachable, misdirected request",
        422: "server reachable, unprocessable content",
        423: "server reachable, locked",
        424: "server reachable, failed dependency",
        425: "server reachable, too early experimental",
        426: "server reachable, upgrade required",
        428: "server reachable, precondition required",
        429: "server reachable, too many requests",
        431: "server reachable, request header fields too large",
        451: "server reachable, server or page unavailable for legal reasons",
        500: "server reachable, internal server error",
        501: "this should not happen, the server is reachable but should never respond with this status code",
        502: "server reachable, bad gateway",
        503: "server reachable, service is unavailable (server may be temporarily down)",
        504: "server reachable, gateway timeout",
        505: "server reachable, HTTP version not supported",
        506: "server reachable, variant also negotiates (server internal error)",
        507: "server reachable, insufficient storage",
        508: "server reachable, loop detected",
        510: "server reachable, extension not supported",
        511: "server reachable, network authentication required",
        null: "any number of issues could cause a null status code, but basically, currently the link is broken"
    }

    var pnthttp = 0, repCnt = 0, totCnt = 0, addr, FID, IDpnt, chkErrs = '', chkResults = '';
    const promises = [];

    /* check for any errors */
    if (ProcessDBSysInfo ("DBLocation") == -1)
        chkErrs += "No active Family DataBase.";
    else
        if (familydata == '')
            chkErrs += "A Family DataBase is active, but it is empty.";
    if (chkErrs != '') {
        chkErrs = "ERRORS " + chkErrs;
        return chkErrs;
    }

    /* proceed with checking and create report */
    chkResults += "<!doctype html> <html> <body id='Body'> <style type='text/css'> @media print { @page { margin-left: 0.5in; margin-right:";
    chkResults += " 0.5in; margin-top: 0; margin-bottom: 0; } #printPB { display: none; } } </style> <pre>";
    chkResults += os.EOL + "MELGenUtils" + os.EOL + "Web Links Report" + os.EOL;
    chkResults += "Active Family DataBase - " + ProcessDBSysInfo("DBName") + os.EOL + os.EOL;

    while (true) {
        pnthttp = familydata.indexOf("http", pnthttp); 
        if (pnthttp === -1) 
            break; 

        for (var x = 0, addr = ''; familydata[pnthttp + x] !== '\n' && familydata[pnthttp + x] !== ',' && familydata[pnthttp + x] !== ' ' &&
                                                                                                        familydata[pnthttp + x] !== ')'; x++) 
            addr += familydata[pnthttp + x]; 

        // find Family Group ID
        IDpnt = familydata.lastIndexOf("\n\n\n", pnthttp);
        if (IDpnt !== -1)
            FID = familydata.substring(IDpnt + 3, familydata.indexOf("  ", IDpnt + 3));
        else
            FID = null;
        // Push the promise returned by checkLinkFetch to the array 
        promises.push(checkLinkFetch(FID, addr)); 

        pnthttp++; 
    }

    // Return the Promise.all() chain so the calling function can await it
    return Promise.all(promises).then(results => {
        results.forEach(result => {
            totCnt++;
            if (result.isBroken === true || result.statusCode !== 200) {
                let description;
                if (result.statusCode in statusCodeDescriptions)
                    description = statusCodeDescriptions[result.statusCode];
                else
                    description = "unknown problem";

                chkResults += "In Family Group " + result.FID + ", url: " + result.url + "  - " + result.statusCode + ", " + description + os.EOL;
                repCnt++;
            }
        })

        chkResults += os.EOL + "Number of links reported - " + repCnt + os.EOL;
        chkResults += "Number of total links checked - " + totCnt + os.EOL;
        chkResults += os.EOL + "End of Web Links Report" + os.EOL;
        chkResults += "</pre> <script type=\"text/javascript\" src=\"clib.js\"></script> <button id='printPB' " +
                      "onclick='userPrint(\"WebLinks\")'>Print Web Links Report</button> </body> </html>";
        return chkResults;
    })
}

async function checkLinkFetch(FID, url) {
    try {
        const response = await fetch(url, { method: 'HEAD' }); 
        const statusCode = response.status; 
        const isBroken = statusCode >= 400 || statusCode < 200; 
        return { FID, url, statusCode, isBroken }; 
    } catch (error) {
        return { FID, url, statusCode: null, isBroken: true, error: error.message }; 
    }
}

function listINDIs (DBName) {
    var b, e, tosend = "", indirec, sect, retitems, lit1, lit2;
    var gedfn = ".GED", dirin, ged, last8Str, last4Str;

    var sysloc = ProcessDBSysInfo("SysLocation");
    dirin = path.join (sysloc, "DBs", DBName, "PlainText");

    /* read GEDCOM */
    fs.readdirSync(dirin).forEach(file => {
        if (gedfn === file.slice(-4).toUpperCase()) {
            const Absolute = path.join(dirin, file);
            if (!(fs.statSync(Absolute).isDirectory()) && !(fs.statSync(Absolute).isSymbolicLink())) {
                var stats = fs.statSync(Absolute);
                try {
                    ged = fs.readFileSync(Absolute, { encoding: 'utf8' });
                    Logging("Read '" + Absolute + "'.");
                    /* ensure Gedcom is ASCII */
                    ged = convertToAscii(ged);
                    Logging("Ensured contents of Gedcom is ASCII. MELGenUtils cannot handle non-ASCII characters at this time. " +
                                 "\(Changed internally only. Did not alter actual Gedcom file.\)");
                    ged = ged.replace(/\r\n/g, "\n");
                    Logging("Removed \"\\r\"'s from Gedcom. \(Changed internally only. Did not alter actual Gedcom file.\)");
                }
                catch (err) {
                    Logging(err + "; problem reading '" + Absolute + "'.");
                }
            }
        }
    })
    tosend += '<head> <style> .radiobut { float: left; width: 5%; } .first { float: left; width: 8%; } ' +
              '.second { float: left; width: 15%; } .third { float: left; width: 6%; } .fourth { float: left; width: 25%; } ' +
              '.fifth { float: left; width: 6%; } .sixth { float: left; width: 25%; } </style> </head> <body> <pre>';
    tosend += os.EOL + "<center>All Individuals in GEDCOM</center>" + os.EOL + os.EOL;
    tosend += '<div class="container"><div class="radiobut">Select</div> <div class="first">Gedcom ID</div> <div class="second">Name</div> ' +
              '<div class="third">Birthdate</div> <div class="fourth">Birthplace</div> <div class="fifth">Deathdate</div> ' +
              '<div class="sixth">Deathplace</div></div>' + os.EOL + os.EOL;
    for (var j = i = 0; i < ged.length; i++, j++) {
        /* extract INDI section */
        b = ged.indexOf('@ INDI', i);
        if (b == -1)
            break;
        b = ged.lastIndexOf('0 @', b);
        e = ged.indexOf('0 ', b + 1);
        if (b == -1 || e == -1)
            break;
        else
            indirec = ged.toString().substring(b, e);
        i = e - 1;

        lit1 = "but" + j;
        lit2 = "div" + j;
        tosend += '<div "class="container"><div class="radiobut"> <input type="radio" id="' + lit1 + '" name="person" value="' + lit1 +
                  '"></div> ' + '<div id="' + lit2 + '"class="first">' +
                  indirec.substring(3, indirec.indexOf('@', 3)) + '</div><div class="second">';
        /* Given Name */
        retitems = extractField (indirec, "2", "GIVN", 0);
        tosend += retitems.str.trim();
        /* Surname */
        retitems = extractField (indirec, "2", "SURN", 0);
        tosend += " " + retitems.str.trim();

        /* extract BIRT section */
        sect = extractSect (indirec, "1", "BIRT");
        /* Birth Date */
        tosend += '</div><div class="third">';
        retitems = extractField (sect, "2", "DATE", 0);
        tosend += retitems.str.trim();
        /* Birth Place */
        tosend += '</div><div class="fourth">';
        retitems = extractField (sect, "2", "PLAC", 0);
        tosend += retitems.str.trim();

        /* extract DEAT section */
        sect = extractSect (indirec, "1", "DEAT");
        /* Death Date */
        tosend += '</div><div class="fifth">';
        retitems = extractField (sect, "2", "DATE", 0);
        tosend += retitems.str.trim();
        /* Death Place */
        tosend += '</div><div class="sixth">';
        retitems = extractField (sect, "2", "PLAC", 0);
        tosend += retitems.str.trim();
        tosend += '</div></div>' + os.EOL;
    }
    tosend += '<div class="container"><div class="radiobut"> <input type="radio" id="none" name="person" value="none">NONE</div>' + os.EOL;
    tosend += "</pre> <center> <button id='acceptInd' onclick='getIndividual();'>Display Individual</button> </center>";
    return tosend;
}

function getINDIData (id) {
    var b, e, tosend = "<pre>", sect, retitems, date, place, childCnt;
    var gedfn = ".GED", dirin, ged, mdate, mplace;

    const sysloc = ProcessDBSysInfo("SysLocation");
    const DBname = ProcessDBSysInfo("DBName");
    dirin = path.join (sysloc, "DBs", DBname, "PlainText");

    /* read GEDCOM */
    fs.readdirSync(dirin).forEach(file => {
        if (gedfn === file.slice(-4).toUpperCase()) {
            const Absolute = path.join(dirin, file);
            if (!(fs.statSync(Absolute).isDirectory()) && !(fs.statSync(Absolute).isSymbolicLink())) {
                var stats = fs.statSync(Absolute);
                try {
                    ged = fs.readFileSync(Absolute, { encoding: 'utf8' });
                    Logging("Read '" + Absolute + "'.");
                    /* ensure Gedcom is ASCII */
                    ged = convertToAscii(ged);
                    Logging("Ensured contents of Gedcom is ASCII. MELGenUtils cannot handle non-ASCII characters at this time. " +
                                 "\(Changed internally only. Did not alter actual Gedcom file.\)");
                    ged = ged.replace(/\r\n/g, "\n");
                    Logging("Removed \"\\r\"'s from Gedcom. \(Changed internally only. Did not alter actual Gedcom file.\)");
                }
                catch (err) {
                    Logging(err + "; problem reading '" + Absolute + "'.");
                }
            }
        }
    })

    tosend += "<br>";
    /* extract INDI section */
    retitems = extract0Rec (ged, '@' + id + '@', "INDI", 0);
    const indiRec = retitems.str;
    if (indiRec == '')
        return "No INDI record in the Gedcom for this individual (ID = " + id + ".<br>This should not happen! Contact MELGenUtils maintainer.<br>";

    tosend += "Data for Individual from Gedcom<br><br>";
    var fullName = GetFullNameFromID (ged, id);
    tosend += "Individual - " + fullName.trim() + "<br>";   // name
    tosend += "Gedcom ID - " + id + "<br>";                 // Gedcom ID
    /* extract BIRT section */
    sect = extractSect (indiRec, "1", "BIRT");
    date = extractField (sect, "2", "DATE", 0);
    place = extractField (sect, "2", "PLAC", 0);
    if (date.str.trim() != "undefined" || place.str.trim() != "undefined")
        tosend += "Born - ";
    if (date.str.trim() != "undefined")
        tosend += date.str.trim() + " ";                    // birth date
    if (place.str.trim() != "undefined")
        tosend += "in " + place.str.trim() + "<br>";        // birth place
    /* extract BAPT section */
    sect = extractSect (indiRec, "1", "BAPT");              // baptismal info
    if (sect == "")                                         // could be in
        sect = extractSect (indiRec, "1", "CHR");           // either section
    date = extractField (sect, "2", "DATE", 0);
    place = extractField (sect, "2", "PLAC", 0);
    if (date.str.trim() != "undefined" || place.str.trim() != "undefined")
        tosend += "Baptized - ";
    if (date.str.trim() != "undefined")
        tosend += date.str.trim() + " ";                    // baptismal date
    if (place.str.trim() != "undefined")
        tosend += "in " + place.str.trim() + "<br>";        // baptismal place
    /* extract DEAT section */
    sect = extractSect (indiRec, "1", "DEAT");
    date = extractField (sect, "2", "DATE", 0);
    place = extractField (sect, "2", "PLAC", 0);
    if (date.str.trim() != "undefined" || place.str.trim() != "undefined")
        tosend += "Died - ";
    if (date.str.trim() != "undefined")
        tosend += date.str.trim() + " ";                    // death date
    if (place.str.trim() != "undefined")
        tosend += "in " + place.str.trim() + "<br>";        // death place
    /* extract BURI section */
    sect = extractSect (indiRec, "1", "BURI");
    date = extractField (sect, "2", "DATE", 0);
    place = extractField (sect, "2", "PLAC", 0);
    if (date.str.trim() != "undefined" || place.str.trim() != "undefined")
        tosend += "Buried - ";
    if (date.str.trim() != "undefined")
        tosend += date.str.trim() + " ";                    // burial date
    if (place.str.trim() != "undefined")
        tosend += "in " + place.str.trim() + "<br>";        // burial place

    last8Str = tosend.slice(-8);
    last4Str = tosend.slice(-4);
    if (last4Str === "<br>") {
        if (last8Str !== "<br><br>")
            tosend += "<br>";
    } else
        tosend += "<br><br>";

    // other stuff for individual
    var Notes = getNotes (indiRec);
    if (Notes.length > 8) {                      // if no Notes, Notes will contain "Notes - "
        Notes = Notes.substring(0, Notes.lastIndexOf(',')) + '.';     // replace the last comma with a period
        tosend += Notes + "<br><br>";
    }

    // parents
    const parents = findFam (ged, indiRec, "FAMC");
    if (parents != -1 && parents != 0) {
        retitems = extractField (parents, "1", "HUSB", 0);
        var idp = retitems.str.trim();
        idp = idp.substring(1, idp.indexOf('@', 1));
        if (idp != '' && idp != "undefined") {
            const fullNamesp = GetFullNameFromID (ged, idp);
            tosend += "Father - " + fullNamesp.trim() + "<br>";                    // father name
        }
        retitems = extractField (parents, "1", "WIFE", 0);
        idp = retitems.str.trim();
        idp = idp.substring(1, idp.indexOf('@', 1));
        if (idp != '' && idp != "undefined") {
            const fullNamesp = GetFullNameFromID (ged, idp);
            tosend += "Mother - " + fullNamesp.trim() + "<br>";                    // mother name
        }
    } else
        tosend += "Father - name unknown<br>Mother - name unknown<br><br>";

    last8Str = tosend.slice(-8);
    last4Str = tosend.slice(-4);
    if (last4Str === "<br>") {
        if (last8Str !== "<br><br>")
            tosend += "<br>";
    } else
        tosend += "<br><br>";

    // get spouse
    const family = findFam (ged, indiRec, "FAMS");
    if (family != -1 && family != '0') {
        // get ID for spouse
        retitems = extractField (family, "1", "HUSB", 0);
        var idt = retitems.str.trim();
        if (idt == "@" + id + "@") {
            retitems = extractField (family, "1", "WIFE", 0);
            idt = retitems.str.trim();
        }
        // get marriage date & place
        sect = extractSect (family, "1", "MARR", 0);
        if (sect != '') {
            retitems = extractField (sect, "2", "DATE", 0);
            mdate = retitems.str.trim();
            retitems = extractField (sect, "2", "PLAC", 0);
            mplace = retitems.str.trim();
        }
        // extract INDI for spouse
        retitems = extract0Rec (ged, idt, "INDI", 0);
        const irecsp = retitems.str.trim();
        if (irecsp != "") {
            idt = idt.substring(1, idt.indexOf('@', 1));
            const fullNamesp = GetFullNameFromID (ged, idt);
            tosend += "Spouse - " + fullNamesp.trim();                    // spouse name
            if (mdate.trim() != "undefined")
                tosend += " " + mdate.trim();
            if (mplace.trim() != "undefined")
                tosend += " in " + mplace.trim();
            tosend += "<br>";
            tosend += "Spouse Gedcom ID - " + idt + "<br><br>";           // spouse Gedcom ID
        }

        // get children
        /* get each child's name */
        for (var childPtr = childCnt = 0; childPtr < family.length; childCnt++) {
            retitems = extractField (family, "1", "CHIL", childPtr);
            childPtr = retitems.e;
            idt = retitems.str.trim();
            if (typeof retitems.str != "undefined" && retitems.str == "undefined")
                /* no more children in FAM */
                break;
            retitems = extract0Rec (ged, idt + " ", "INDI", 0);
            const irecChild = retitems.str.trim();
            retitems = extractField (irecChild, "2", "GIVN", 0);
            chName = retitems.str.trim();
            if (!childCnt)
                tosend += "Children - " + chName + "<br>";
            else
                tosend += "           " + chName + "<br>";
        }
    }

    tosend += "<br></pre>";
    return tosend;
}

function getNotes (indiRec) {
    var Notes = "Notes - ", retStuff;

    retStuff = processOther ("SSN", "SSN", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("EMAIL", "email address", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("ADDR", "lived at", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("RESI", "lived at", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("OCCU", "worked as a", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("ADOP", "adopted", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("NICK", "known as", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("ALIA", "known as", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("RELI", "a", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("CREM", "cremated", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("RETI", "retired", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("NATU", "naturalized", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("EMIG", "emigrated", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("IMMI", "immigrated", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("EDUC", "attended", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("GRAD", "graduated from", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';
    retStuff = processOther ("DSCR", "described as", indiRec, "1");
    if (retStuff != '')
        Notes += retStuff + ', ';

    return Notes;
}

function processOther (what, lit, irec, level) {
    var sect, edate = '', eplace = '', contents = '', stuff = '';

    sect = extractSect (irec, level, what);
    if (sect != "") {
        retitems = extractField (sect, "1", what, 0);
        contents = retitems.str.trim();
        retitems = extractField (sect, "2", "DATE", 0);
        edate = retitems.str.trim();
        retitems = extractField (sect, "2", "PLAC", 0);
        eplace = retitems.str.trim();

        if (contents != '' && contents != "undefined")
            stuff = lit + " " + contents;
    }     

    return stuff;
}

/* from stackoverflow.com */
function convertToAscii(string) {
    const unicodeToAsciiMap = {'Ⱥ':'A','Æ':'AE','Ꜻ':'AV','Ɓ':'B','Ƀ':'B','Ƃ':'B','Ƈ':'C','Ȼ':'C','Ɗ':'D','ǲ':'D','ǅ':'D','Đ':'D','Ƌ':'D','Ǆ':'DZ','Ɇ':'E','Ꝫ':'ET','Ƒ':'F','Ɠ':'G','Ǥ':'G','Ⱨ':'H','Ħ':'H','Ɨ':'I','Ꝺ':'D','Ꝼ':'F','Ᵹ':'G','Ꞃ':'R','Ꞅ':'S','Ꞇ':'T','Ꝭ':'IS','Ɉ':'J','Ⱪ':'K','Ꝃ':'K','Ƙ':'K','Ꝁ':'K','Ꝅ':'K','Ƚ':'L','Ⱡ':'L','Ꝉ':'L','Ŀ':'L','Ɫ':'L','ǈ':'L','Ł':'L','Ɱ':'M','Ɲ':'N','Ƞ':'N','ǋ':'N','Ꝋ':'O','Ꝍ':'O','Ɵ':'O','Ø':'O','Ƣ':'OI','Ɛ':'E','Ɔ':'O','Ȣ':'OU','Ꝓ':'P','Ƥ':'P','Ꝕ':'P','Ᵽ':'P','Ꝑ':'P','Ꝙ':'Q','Ꝗ':'Q','Ɍ':'R','Ɽ':'R','Ꜿ':'C','Ǝ':'E','Ⱦ':'T','Ƭ':'T','Ʈ':'T','Ŧ':'T','Ɐ':'A','Ꞁ':'L','Ɯ':'M','Ʌ':'V','Ꝟ':'V','Ʋ':'V','Ⱳ':'W','Ƴ':'Y','Ỿ':'Y','Ɏ':'Y','Ⱬ':'Z','Ȥ':'Z','Ƶ':'Z','Œ':'OE','ᴀ':'A','ᴁ':'AE','ʙ':'B','ᴃ':'B','ᴄ':'C','ᴅ':'D','ᴇ':'E','ꜰ':'F','ɢ':'G','ʛ':'G','ʜ':'H','ɪ':'I','ʁ':'R','ᴊ':'J','ᴋ':'K','ʟ':'L','ᴌ':'L','ᴍ':'M','ɴ':'N','ᴏ':'O','ɶ':'OE','ᴐ':'O','ᴕ':'OU','ᴘ':'P','ʀ':'R','ᴎ':'N','ᴙ':'R','ꜱ':'S','ᴛ':'T','ⱻ':'E','ᴚ':'R','ᴜ':'U','ᴠ':'V','ᴡ':'W','ʏ':'Y','ᴢ':'Z','ᶏ':'a','ẚ':'a','ⱥ':'a','æ':'ae','ꜻ':'av','ɓ':'b','ᵬ':'b','ᶀ':'b','ƀ':'b','ƃ':'b','ɵ':'o','ɕ':'c','ƈ':'c','ȼ':'c','ȡ':'d','ɗ':'d','ᶑ':'d','ᵭ':'d','ᶁ':'d','đ':'d','ɖ':'d','ƌ':'d','ı':'i','ȷ':'j','ɟ':'j','ʄ':'j','ǆ':'dz','ⱸ':'e','ᶒ':'e','ɇ':'e','ꝫ':'et','ƒ':'f','ᵮ':'f','ᶂ':'f','ɠ':'g','ᶃ':'g','ǥ':'g','ⱨ':'h','ɦ':'h','ħ':'h','ƕ':'hv','ᶖ':'i','ɨ':'i','ꝺ':'d','ꝼ':'f','ᵹ':'g','ꞃ':'r','ꞅ':'s','ꞇ':'t','ꝭ':'is','ʝ':'j','ɉ':'j','ⱪ':'k','ꝃ':'k','ƙ':'k','ᶄ':'k','ꝁ':'k','ꝅ':'k','ƚ':'l','ɬ':'l','ȴ':'l','ⱡ':'l','ꝉ':'l','ŀ':'l','ɫ':'l','ᶅ':'l','ɭ':'l','ł':'l','ſ':'s','ẜ':'s','ẝ':'s','ɱ':'m','ᵯ':'m','ᶆ':'m','ȵ':'n','ɲ':'n','ƞ':'n','ᵰ':'n','ᶇ':'n','ɳ':'n','ꝋ':'o','ꝍ':'o','ⱺ':'o','ø':'o','ƣ':'oi','ɛ':'e','ᶓ':'e','ɔ':'o','ᶗ':'o','ȣ':'ou','ꝓ':'p','ƥ':'p','ᵱ':'p','ᶈ':'p','ꝕ':'p','ᵽ':'p','ꝑ':'p','ꝙ':'q','ʠ':'q','ɋ':'q','ꝗ':'q','ɾ':'r','ᵳ':'r','ɼ':'r','ᵲ':'r','ᶉ':'r','ɍ':'r','ɽ':'r','ↄ':'c','ꜿ':'c','ɘ':'e','ɿ':'r','ʂ':'s','ᵴ':'s','ᶊ':'s','ȿ':'s','ɡ':'g','ᴑ':'o','ᴓ':'o','ᴝ':'u','ȶ':'t','ⱦ':'t','ƭ':'t','ᵵ':'t','ƫ':'t','ʈ':'t','ŧ':'t','ᵺ':'th','ɐ':'a','ᴂ':'ae','ǝ':'e','ᵷ':'g','ɥ':'h','ʮ':'h','ʯ':'h','ᴉ':'i','ʞ':'k','ꞁ':'l','ɯ':'m','ɰ':'m','ᴔ':'oe','ɹ':'r','ɻ':'r','ɺ':'r','ⱹ':'r','ʇ':'t','ʌ':'v','ʍ':'w','ʎ':'y','ᶙ':'u','ᵫ':'ue','ꝸ':'um','ⱴ':'v','ꝟ':'v','ʋ':'v','ᶌ':'v','ⱱ':'v','ⱳ':'w','ᶍ':'x','ƴ':'y','ỿ':'y','ɏ':'y','ʑ':'z','ⱬ':'z','ȥ':'z','ᵶ':'z','ᶎ':'z','ʐ':'z','ƶ':'z','ɀ':'z','œ':'oe','ₓ':'x'};
    const stringWithoutAccents = string.normalize("NFD").replace(/[\u0300-\u036f]/g, '');
    return stringWithoutAccents.replace(/[^\u0000-\u007E]/g, character => unicodeToAsciiMap[character] || '');
}

module.exports = { ProcessDBSysInfo, UpdateDBSysInfo, TimelineEvents, ReadFamilyDB, ReadIndex, DetermineSection, Look4Match, ChildrenMatch,
                   DBInfo, dirExist, OTDEvents, TOC, Logging, createDBinfo, yyyymmdd, extract0Rec, extractField, romanize, getParentID,
                   getParentName, findFam, Check4Children, extractSect, GoThruDirectory, PreSetFocusID, DoSetFocusID, loadFamDB, DBIndex,
                   ChkLinks, GetFullNameFromID, listINDIs, convertToAscii, getINDIData };

