MELGenUtils Readme {#header}
================

------------------------------------------------------------------------

\

Project Title
-------------

\
MEL Genealogy Utilities (or MELGenUtils)\
v20251201\
An aid for genealogists. A \"full stack\" application written in
JavaScript, HTML and CSS.\
\
\
\

Project Description
-------------------

\
MELGenUtils is a menu-based application offering many functions and utilities
useful to a genealogist including database management, creation of HTML
versions of a DataBase & Web sites, search aid (records and data),
verify/inspect/analyze data, reports, auto-updating of MELGenUtils Family
DataBases and various on-line DataBases/Trees, and many other
functions/utilities.\
\
MELGenUtils should run on Microsoft Windows, MacOS and/or Linux as is.\
\
\
\

Technologies Used
-----------------

\
MELGenUtils is written in vanilla JavaScript. No frameworks have been
used. External libraries have been used only when necessary.\
\
\
\

Requirements
------------

\
browser - tested with Firefox, Chromium, Brave, Opera, Vivaldi\
Note - using Brave, if node/server not recognized or not connected, in
Brave go to Settings -\> Shields and disable \"Trackers & ads
blocking\"\
platform - developed on Linux, tested on Linux & Windows)\
node.js - using v20.11.1 during development\
external libraries: fs-extra (v10.0.1), websocket (v1.0.34),
node-schedule (v2.1.1), nodemailer (v6.9.15) and fuse (v6.6.2)\
\
\
\

Project Objectives
------------------

\
1. Run as is on Linux, Apple or Windows.\
2. Bring together all functions and utilities useful to genealogists in one place, all on a personal computer under the user's control.\
3. Ability to sync data on host machine, any other host machines
running MELGenSys and utilizing the same data, and any public tree sites
(e.g., WikiTree.com, Ancestry.com, FamilySearch.org, etc).\
4. Every data item in the database to be sourced/cited.\
5. Simple to use for everyone, including computer-challenged users.\
6. Always Open Source.\
\
\
\

Installation Instructions
-------------------------

\
Install nodejs on your computer if not already installed. Download the
MELGenUtils zip file. Ensure the MELGenUtils zip file is in your home
directory. Extract the MELGenUtils zip file. Navigate into the new
directory/folder created from the extraction (this is the MELGenUtils
root directory/folder). While in the MELGenUtils root directory/folder,
type \"npm install\" (without the quotes) and press RETURN. At this
point everything should be installed.\
\
To run, while still in the MELGenUtils root directory/folder, type \"node
./MELGenUtilsSS.js\" (without the quotes) and press RETURN. This starts the
server portion of MELGenUtils. To start the client, double-click on the
icon labeled \"MELGenUtils.html\". Or, in the address line of your browser
of choice enter the proper address to access \"MELGenUtils.html\".\
\
For perhaps a more complete MELGenUtils installation guide, see the file
\"Overview.html\" in the \"Docs\" directory/folder.\
\
A test DataBase is included with the project. Create an empty
directory/folder, likely in your home directory. Navigate into the Notes
directory/folder located in the MELGenUtils root directory (where
MELGenUtils is installed). Copy the file \"TestDB-26Sep2025.zip\" into the
empty directory/folder just created. Navigate into this
directory/folder. Unzip \"TestDB-26Sep2025.zip\". Delete
\"TestDB-26Sep2025.zip\". Execute the MELGenUtils server. Execute the
MELGenUtils client. In the main menu of the client, click \"Import, Create
or Remove a Family DataBase\". In the next menu, click \"Import a Family
DataBase from User Created Files\". On the ensuing form, enter the
location of the directory/folder containing the files to import. This
would be the name of the directory/folder which houses the files unzipped
from \"TestDB-26Sep2025.zip\". (Note - If the directory/folder was created
in your home directory, just entering the name of the directory/folder is
enough. If the directory/folder was created someplace else, then enter
the full path to the directory/folder.) In the form, enter a name to
assign to the Family DataBase \... maybe \"TestDB\". After completing
the form, click \"Import DB\". The DataBase should import successfully
with no fatal errors.\
\
\
\

Usage Instructions
------------------

\
Usage instructions are fairly self-explanatory after loading the
application. Each function is described in full in the menu function
\"Help/Info/Docs -\> Using MELGenUtils\" (click the button labeled
\"Help/Info/Docs\" in the main menu, then click the button labeled
\"Using MELGenUtils\" in the menu which follows). For some basic \"getting
started\" instructions see \"Help/Info/Docs -\> MELGenUtils Frequently
Asked Questions\".\
\
\
\

Documentation
-------------

\
In the application, click the button labeled \"Help/Info/Docs\" on the
main menu.\
\
\
\

Support Information
-------------------

\
If you have questions or need additional help, send an email to
[MarshallELake @ gmail dot com](mailto:marshallelake@gmail.com) or
[Marshall Lake @ mlake dot net](mailto:genealogy@mlake.net).\
\
You may also click the button labeled \"Help/Info/Docs\" on the main
menu, then click the button labeled \"Contact Developer of MELGenUtils via
email\".\
\
\
\

Project Roadmap
---------------

\
MELGenUtils is a work-in-progress and not all menu functions are available
with the current version (v20251201). As new functions become available
and/or improvements are made to the application new versions of
MELGenUtils will become available.\
\
Also, see \"Help/Info/Docs -\> MELGenUtils Development History\".\
\
\
\

Project Status
--------------

\
Active/In development.\
\
\
\

Contribution Guidelines
-----------------------

\
If you would like to help/contribute with development, [see this
file](../Notes/Notes2PossibleContributors.md) for some info. After
reading this file, if you would like to help, drop me a note at
[MarshallELake @ gmail dot com](mailto:marshallelake@gmail.com).\
\
Future: Third party add-ons or extensions may be developed to be
included in MELGenUtils. See \"Miscellaneous Functions -\> Import Add-on
for MELGenUtils\" and \"Help/Info/Docs -\> MELGenUtils Add-ons\".\
\
To report a bug, send an email to [MarshallELake @ gmail dot
com](mailto:marshallelake@gmail.com) or [Marshall Lake @ mlake dot
net](mailto:genealogy@mlake.net).\
\
In the application, you may also use \"Help/Info/Docs -\> Contact
Developer of MELGenUtils via email\" or \"Miscellaneous Functions -\> Send
Suggestions/Ideas to Developer of MELGenUtils\".\
\
\
\

Acknowledgments
---------------

\
Even though I\'ve been the only developer on this project (so far), I
consider it very much a community project. I\'ve received inspiration
from many that will go unnamed, all the people that I have exchanged
info with over the years, all the people I\'ve read from and listened to
over the years, all the genealogy-related groups I\'ve been involved in
over the years - I\'ve gotten ideas and inspiration from all of them.
They are all a part of this project.\
\
Shout out to stackoverflow.com as an aid in learning JavaScript and for
helping solve problems along the way.\
\
ChatGPT and Gemini have also provided assistance.\
\
\

License Information
-------------------

\
GNU GPLv3\
\
\

------------------------------------------------------------------------
