(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function(){ "use strict";

window.CodeArea = require('./editor')
window.CodeArea.Mode = require('./lexer')
window.CodeArea.modes = 
{ js: require('./modes/js')
, plain: require('./modes/plain')
//, html: require('./modes/html')
}

})()
},{"./editor":2,"./lexer":3,"./modes/js":4,"./modes/plain":5}],2:[function(require,module,exports){
(function(){ "use strict";

// DOM tree walker
// traverses depth-first, left to right
// emits ['start', domNode], and ['end', domNode] tokens

function TreeWalker (tree) {
	var path = { node:tree, index:0, tail:null }
	return { next:next }
	// where
	function next () {
		if (!path) return null
		var n = path.node, i = path.index
		if ('childNodes' in n && n.childNodes.length > i) {
			n = n.childNodes[i]
			path = { node:n, index:0, tail:path }
			return ['start', n]
		}
		else if (path.tail !== null) {
			var t = path.tail
			path = { node:t.node, index:t.index+1, tail:t.tail }
			return ['end', n]
		}
		else {
			path = null
			return ['end', n]
		}
	}
}

// Parser (a TreeWalker)
// This parses a DOM tree to a plain text string with a cursor position,
// returns an object { text:string, cursor:number }

var br_map = { BR:1, H1:2, H2:2, H3:1, H4:1, H5:1, H6:1, P:2, DIV:2, FORM:2, LI:1, UL:2, OL:2, TR:1, TABLE:2 }

function parse (elem) {
	var xs = new TreeWalker (elem)
		, sel = elem.ownerDocument.getSelection()
		, text = '', cursor = 0
		, p = 0, n = xs.next()

	while (n !== null) {
		var c = n[0], node = n[1]
		if (c === 'start' && node === sel.anchorNode)
			cursor = p+sel.anchorOffset
		
		else if (node.nodeType === elem.ELEMENT_NODE && c === 'end' && (node.nodeName in br_map)) {
			var amount = br_map[node.nodeName]
			text += Array(amount+1).join('\n')
			p += amount
		}
		else if (c === 'end' && node.nodeType === elem.TEXT_NODE) {
			text += node.nodeValue
			p += node.nodeValue.length
		}
		n = xs.next()
	}
	return { text:text, cursor:cursor }
}


// Render
// ------
// Renders a plain text string with cursor position
// into the DOM element and a new DOM selection, 
// using Lexer to tokenize the string

function render (content, mode, elem) {
	var doc = elem.ownerDocument
	var frag = doc.createDocumentFragment()
	var tokens = new mode (content.text)
		, last = tokens.info().position
		, tok = tokens.next()
		, next
		, sel = { node:elem, offset:0 }

	while (tok !== null) {
		next = tokens.info().position
		var span = toSpan(tok, doc)
		frag.appendChild(span)
		if (last < content.cursor && next >= content.cursor)
			sel = { node:span.firstChild, offset:content.cursor-last }
		last = next
		tok = tokens.next()
	}
	while (elem.lastChild)
		elem.removeChild(elem.lastChild)
	elem.appendChild(frag) 

	var s = doc.selection ? doc.selection
			: doc.getSelection ? doc.getSelection()
			: window.getSelection ? window.getSelection()
			: null

	if (s.setBaseAndExtent) // Webkit
		s.setBaseAndExtent(sel.node, sel.offset, sel.node, sel.offset)

	else if (s.removeAllRanges) { // Firefox
		var r = doc.createRange()
		r.setStart(sel.node, sel.offset)
		r.setEnd(sel.node, sel.offset)
		s.removeAllRanges()
		s.addRange(r)
	}

}

function toSpan (token, doc) { 
	var span = doc.createElement('SPAN')
	span.className = token[0]
	span.appendChild(doc.createTextNode(token[1]))
	return span }



// Editor
// Wraps all of the above in a state container
// with undo / redo management
	
function Editor (element, mode) {
	var elem = element
		, mode = mode // A function from string to a lazy token stream
		, undo_stack = []
		, undo_index = -1

	//var evs = ('oninput' in elem) ? ['input'] : ['input', 'keyup', 'cut', 'paste']
	var evs = ['input', 'keyup', 'cut', 'paste']
	for (var i=0,l=evs.length; i<l; i++)
		elem.addEventListener(evs[i], setFromDom)

	elem.addEventListener('keydown', onkeydown)
	element.spellcheck = false
	setFromDom()

	return { get:get, set:set }

	// Only captures Tab, Enter, Undo and Redo commands
	function onkeydown (e) {
		var command = keyName(e)
		switch (command) {
			case 'Tab':
				e.preventDefault()
				insert('\t'); break

			case 'Enter':
			case 'Shift-Enter':
				e.preventDefault()
				insert('\n'); break

			// Undo
			case 'Cmd-Z':
			case 'Ctrl-Z':
				e.preventDefault()
				undo()
			break

			// Redo
			case 'Shift-Cmd-Z':
			case 'Shift-Ctrl-Z':
			case 'Cmd-Y':
			case 'Ctrl-Y':
				e.preventDefault()
				redo()
		}
	}

	function undo () {
		if (undo_index > 0) {
			undo_index--
			draw() } }

	function redo () {
		if (undo_index+1 < undo_stack.length) {
			undo_index++
			draw() } }

	function insert (snippet) {
		var content = parse(elem)
		var t = content.text, a = content.cursor
		var t = t.slice(0, a)+snippet+t.slice(a)
		set ({ text:t, cursor:a+snippet.length })
	}

	function setFromDom () {
		var content = parse(elem), last = get()
		if (!last || content.text !== last.text)
			set(content) }
	
	function set (content) {
		undo_stack = undo_stack.slice(0, undo_index+1)
		undo_index += 1
		undo_stack[undo_index] = content
		draw()
	}

	function get () {
		return undo_stack[undo_index]
	}

	function draw () {
		render(get(), mode, elem)
	}

	function setMode (mode_) {
		mode = mode_
		draw()
	}

}


var keymap = 
	{ 9:'Tab', 3:'Enter', 13:'Enter', 89:'Y', 90:'Z' }

function keyName (evt) {
	if (!evt.altGraphKey && evt.keyCode in keymap) {
		var modifiers = []
		if (evt.shiftKey) modifiers.push("Shift")
		if (evt.ctrlKey) modifiers.push("Ctrl")
		if (evt.metaKey) modifiers.push("Cmd")
		if (evt.altKey) modifiers.push("Alt")
		modifiers.push(keymap[evt.keyCode])
		return modifiers.join('-')
	}
}

module.exports = Editor
})()
},{}],3:[function(require,module,exports){
(function(){ "use strict";

// Lexer
// =====
// This is a runtime and 'compiler' for lexical grammars. 
// The idea is that lexical grammars can be very compactly expressed as a
// finite state machine that has transitions labeled with regular expressions,
// rather than with individual characters. 
//
// The javascript RegExp object allows reading and writing the position
// of reference in the input string, so it is possible to model each 
// state of the machine as a single RegExp object with capture groups. 
// The capture groups then correspond to the transitions. 
//
// Such a state machine is compiled from a json object describing the grammar. 
// This is an object map from state-names to a list of transitions, each
// transition being a tuple (an array) [regexp_string, token_name, next_state]

// The compiler
// ------------

function State (table) {
	this.regex = new RegExp('('+table.map(fst).join(')|(')+')', 'g')
	this.transitions = table.map(function(x){return x.slice(1)})
}

function compile (grammar) {
	var compiled = {}
	for (var state_name in grammar)
		compiled[state_name] = new State(grammar[state_name])
	return compiled
}

function fst (a) {
	return a[0] }


// The Runtime
// -----------
// A lazy stream of tokens

function Lexer (grammar, start) { return function TokenStream (input) {
	var _sm = compile(grammar)
	var p = 0, state = start // It's the state-name really
	return { next:next, all:all, info:info }

	function info () {
		return { position:p, state:state }
	}

	function all () {
		var r = []
		var t = next()
		while (t != null) {
			r.push(t)
			t = next() }
		return r }

	function next () {
		if (_sm[state] == null) {
			console.log(['error', { message:'no such state', position:p, state:state }])
			return null //['error', p, state]
		}
		var regex = _sm[state].regex
		var transitions = _sm[state].transitions
		
		regex.lastIndex = p
		var r = regex.exec(input)
		if (r == null) return null // TODO is that right?
		var i = 1; while (r[i] == null) i++

		var token = [transitions[i-1][0], r[i], state]
		p = regex.lastIndex
		state = transitions[i-1][1]
		return token
	}
}}

module.exports = Lexer
})()
},{}],4:[function(require,module,exports){
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
},{"../lexer":3}],5:[function(require,module,exports){
(function(){ "use strict";

function Plain (input) {
	var p = 0
	return { next:next, info:info }

	function next () {
		if (p < input.length) {
			p = input.length
			return ['text', input]
		}
		else 
			return null
	}

	function info () {
		return {position:p, state:'start' }
	}

}

module.exports = Plain
})()
},{}]},{},[1]);
