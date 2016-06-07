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

function Lexer (grammar) { return function TokenStream (input) {
	var _sm = compile(grammar)
	var p = 0, state = 'start' // It's the state-name really
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