/* check if there is an activated DataBase */
function check4ActiveDB() {
    var res;

    return new Promise((res) => {
        const ws = new WebSocket('ws://localhost:3000/');

        ws.onerror = function(evt) {
            if (ws.readyState == 3)
                res(-2);               /* server not running */
        }
        ws.onopen = function() {
            ws.send("DBName");
        }
        ws.onmessage = function(e) {
            if (e.data !== '-1') {
                /* there is an active DB; check if it's verified */
                ws.send("DBStatus");
                ws.onmessage = function(e) {
                    if (e.data == '1' || e.data == '3')
                        res(0);               /* there is an active DataBase and it is verified */
                    else
                        res(-3);              /* there is an active DataBase but it is NOT verified */
                }
            } else
                res(-1);              /* no active DataBase */
        }
    })
}

/* show other individual data */
function showIData(id) {
    const ws = new WebSocket('ws://localhost:3000/');
    ws.onopen = function() {
        ws.send("GetINDIData " + id);
        ws.onmessage = function(e) {
            var w = window.open('about:blank');
            w.document.open();
            w.document.write(e.data);
            w.document.close();
        }
    }
}

/* user wants to Print; reformat area to print depending upon user-selected max line length */
function userPrint(what) {
    var indent, linelen, ctext, bpos, lpos, spacepos, ll, x, newlinesw;
    var body = document.getElementById("Body").innerHTML;
    var origbody = document.getElementById("Body").innerHTML;
    var whitespace = "                   ", UserPrefs = {}, defMax;

    UserPrefs.length = 0;
    const ws = new WebSocket('ws://localhost:3000/');

    function getUserPrefs() {
        return new Promise((resolve, reject) => {
            ws.onopen = function() {
                ws.send("GetUserPrefs");
            }

            ws.onmessage = function(e) {
                try {
                    UserPrefs = JSON.parse(e.data);
                    if (UserPrefs.length === 0)
                        defMax = 75;
                    else
                        defMax = UserPrefs.NumCol;
                    resolve(UserPrefs);
                } catch (error) {
                    reject(error);
                }
            }

            ws.onerror = function(error) {
                reject(error);
            }
        })
    }

    async function main() {
        try {
            await getUserPrefs();
            if (what == "Timeline" || what == "OnThisDay")
                indent = 14;
            if (what == "Search" || what == "WebLinks")
                indent = 4;
            if (what == "Inspect")
                indent = 8;
            if (what == "Verify")
                indent = 15;
            if (what == "Log")
                indent = 25;

            ll = prompt('Enter the maximum character line length for printing:', defMax);
            if (!ll)
                return; // user canceled
            if (ll < 40) {
                alert(`The value ${ll} is unacceptably low. Try again.`);
                return;
            } else
                if (ll < 50 || ll > 120)
                    if (!confirm(`The value ${ll} is outside the normal range. Click OK to confirm the value, or click Cancel.`))
                        return;

            x = body.indexOf("<pre>");
            for (newlinesw = lpos = 0, bpos = x + 5; bpos < body.length; bpos++) {
                if (body[bpos] == '\n') {
                    lpos = 0;
                    continue;
                }
                if (body.substring(bpos, bpos + 6) == "</pre>")
                    break;

                if (lpos >= ll) {
                    /* if the text to be printed is too big, it takes too much time to run the code in the "if" block */
                    if (body.length < 1000) {
                        for (x = bpos; lpos != 0; lpos--, x--)
                            if (body[x] == ' ') {
                                spacepos = x;
                                break;
                            }
                        if (!lpos) {
                            newlinesw = 1;
                            spacepos = bpos;
                        }
                    } else {
                        newlinesw = 1;
                        spacepos = bpos;
                    }

                    body = body.substring(0, spacepos) + "\n" + whitespace.substring(0, indent) + body.substring(spacepos + 1 - newlinesw);
                    bpos = spacepos + newlinesw;
                    newlinesw = lpos = 0;
                    continue;
                }
                lpos++;
            }

            document.getElementById("Body").innerHTML = body;
            window.print();
            document.getElementById("Body").innerHTML = origbody;
        } catch (error) {
            console.error('Error:', error);
        }
    }

    main();
}

