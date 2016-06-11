(function(){ "use strict";
var Lexer = require('../lexer')

// Lexical grammar for javascript
// ==============================

var keywords = ['break','do','in','typeof','case','else','instanceof','var','catch','export','new','void','class','extends','return','while','const','finally','super','with','continue','for','switch','yield','debugger','function','this','default','if','throw','delete','import','try',]
	, futurewords = ['enum', 'await','implements','package','protected','interface','private','public']
	, keywords_ex = '(?:'+keywords.concat(futurewords).join('|')+')\\b'

// Punctuators, sorted by decreasing length
// TODO: write a to_regex function that escapes the strings properly into a regex, and use that
var punctuators = ['>>>=','!==','**=','...','<<=','===','>>=','>>>','!=','%=','&&','&=','**','*=','++','+=','--','-=','<<','<=','==','=>','>=','>>','^=','|=','||','!','%','&','(',')','*','+',',','-','.',':',';','<','=','>','?','[',']','^','{','|','~']

// var space_ex = '[\\u0009\\u000B\\u000C\\u0020\\u00A0\\uFEFF\\u0020\\u00A0\\u1680\\u2000-\\u200A\\u202F\\u205F\\u3000]+'
var space_ex = '[\\s]+' // FIXME, follow the ECMA specification

// Line terminators:
// U+000A LINE FEED (LF)	<LF> \n
// U+000D CARRIAGE RETURN (CR)	<CR> \r
// U+2028 LINE SEPARATOR	<LS> \u2028
// U+2029 PARAGRAPH SEPARATOR <PS> \u2029


var grammar = 
{ start:
	[ ['function\\b', 'function', 'afterFunction']
	, ['var\\b|let\\b', 'declaration', 'start']
	, ['new\\b', 'new', 'afterNew']
	, ['this\\b', 'this', 'start']

	// Spec compliant from here

	, [space_ex, 'space', 'start']
	, [keywords_ex, 'control', 'start']

	// String literals
	, ["'", 'beginString', 'singleQuotedString']
	, ['"', 'beginString', 'doubleQuotedString']

	// Null and Boolean literals
	, ['null\\b', 'null', 'start']
	, ['true\\b|false\\b', 'boolean', 'start']

	// Comments
	, ['//[^\\n\\r\\u2028\\u2029]*', 'comment', 'start']
	, ['/\\*', 'beginComment', 'multilineComment']

	// Numerals
	, ['0(?:x|X)[0-9a-fA-F]+', 'hexInteger', 'start']
	, ['0(?:o|O)[0-7]+', 'octalInteger', 'start']
	, ['0(?:b|B)[01]+', 'binaryInteger', 'start']

	// Decimal numerals
	, ['0|[1-9][0-9]*', 'decimalInteger', 'afterDecimalInteger']
	, ['\\.[0-9]+', 'fractionalPart', 'afterFractionalPart']
	// TODO: Numeric literals must not be followed by ...
	// IdentifierStart or DecimalDigit

	// Non-spec again
	, ['[a-zA-Z$_][a-zA-Z0-9$_]*', 'symbol', 'start']
	//
	, ['\\(|\\)|\\{|\\}|\\[|\\]', 'group', 'start']
	, ['\\+\\+|\\+|=|==|===|!=|!==|-|--|>|<|&&|\\|\\||!|\\.|\\:', 'operator', 'start']
	, ['\\.', 'dot', 'start']
	, [',', 'comma', 'start']
	, [':', 'colon', 'start']
	, [';', 'semi', 'start']

	, ['.', 'unknown', 'start']
	],

afterDecimalInteger:
	[ ['\\.[0-9]*', 'fractionalPart', 'afterFractionalPart']
	, ['[eE][+-]?[0-9]+', 'exponentPart', 'start']
	, ['.{0}', 'finishDecimal', 'start']
	],

afterFractionalPart:
	[ ['[eE][+-]?[0-9]+', 'exponentPart', 'start']
	, ['.{0}', 'finishDecimal', 'start']
	],

multilineComment:
	[ ['[^\\*]+', 'commentData', 'multilineComment'] // any up to a *
	, ['\\*/', 'finishComment', 'start']
	, ['\\*[^\\*]*', 'commentData', 'multilineComment'] // * any upto *
	],

doubleQuotedString:
	[ ['"'                                  , 'finishString'    , 'start']
	, ['[^\\\\\"\\n\\r\\u2028\\u2029]+'     , 'stringChars'     , 'doubleQuotedString']
	, ['\\\\[\'"\\\\bfnrtv]'                , 'charEscape'      , 'doubleQuotedString']
	, ['\\\\0'                              , 'nullEscape'      , 'doubleQuotedString'] // TODO lookahead is not 1-9
	, ['\\\\x[0-9a-fA-F]{2}'                , 'hexEscape'       , 'doubleQuotedString']
	, ['\\\\u[0-9a-fA-F]{4}'                , 'unicodeEscape'   , 'doubleQuotedString']
	, ['\\\\u\\{[0-9a-fA-F]+\\}'            , 'unicodeEscape'   , 'doubleQuotedString']
	, ['\\\\(?:\\n|\\r\\n?|\\u2028|\\u2029)', 'lineContinuation', 'doubleQuotedString']
	, ['\\\\[1-9]'                          , 'invalidEscape'   , 'doubleQuotedString'] // error - legacy octal
	, ['\\\\'                               , 'nonEscape'       , 'doubleQuotedString']
	, ['[\\n\\r\\u2028\\u2029]'             , 'invalid'         , 'doubleQuotedString'] // Line terminators are not allowed in strings
	],

singleQuotedString:
	[ ["'"                                  , 'finishString'    , 'start']
	, ["[^\\\\'\\n\\r\\u2028\\u2029]+"      , 'stringChars'     , 'singleQuotedString'] // Rest is same as above
	, ['\\\\[\'"\\\\bfnrtv]'                , 'charEscape'      , 'singleQuotedString']
	, ['\\\\0'                              , 'nullEscape'      , 'singleQuotedString'] // TODO lookahead is not 1-9
	, ['\\\\x[0-9a-fA-F]{2}'                , 'hexEscape'       , 'singleQuotedString']
	, ['\\\\u[0-9a-fA-F]{4}'                , 'unicodeEscape'   , 'singleQuotedString']
	, ['\\\\u\\{[0-9a-fA-F]+\\}'            , 'unicodeEscape'   , 'singleQuotedString']
	, ['\\\\(?:\\n|\\r\\n?|\\u2028|\\u2029)', 'lineContinuation', 'singleQuotedString']
	, ['\\\\[1-9]'                          , 'invalidEscape'   , 'singleQuotedString'] // error - legacy octal
	, ['\\\\'                               , 'nonEscape'       , 'singleQuotedString']
	, ['[\\n\\r\\u2028\\u2029]'             , 'invalid'         , 'singleQuotedString'] // Line terminators are not allowed in strings
	],


// Non spec states

afterFunction: 
	[ ['\\s+', 'space', 'afterFunction']
	, ['[a-zA-Z$_][a-zA-Z0-9$_]*', 'functionName', 'afterFunction']
	, ['\\(', 'beginParams', 'params']
	, ['.{0}', 'unknown', 'start']
	],

params:
	[ ['\\s+', 'space', 'params']
	, ['[a-zA-Z$_][a-zA-Z0-9$_]*', 'param', 'params']
	, [',', 'comma', 'params']
	, ['\\)', 'finishParams', 'afterParams']
	, ['.{0}', 'invalid', 'start']
	],

afterParams:
	[ ['\\s+', 'space', 'afterParams']
	, ['\\{', 'beginBody', 'start']
	, ['.{0}', 'invalid', 'start']
	],

afterNew: 
	[ ['\\s+', 'space', 'afterNew']
	, ['[a-zA-Z$_][a-zA-Z0-9$_]*', 'constructor', 'start']
	, ['.{0}', 'invalid', 'start']
	],

}


module.exports = Lexer(grammar, 'start')
})()