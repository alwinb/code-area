(function(){ "use strict";

window.CodeArea = require('./editor')
window.CodeArea.modes = 
{ js: require('./modes/js')
, plain: require('./modes/plain')
}

})()