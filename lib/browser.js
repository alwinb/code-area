(function(){ "use strict";

window.CodeArea = require('./editor')
window.CodeArea.Mode = require('./lexer')
window.CodeArea.modes = 
{ js: require('./modes/js')
, plain: require('./modes/plain')
//, html: require('./modes/html')
}

})()