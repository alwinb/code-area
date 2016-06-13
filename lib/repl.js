//(function(){ "use strict";

// A simple REPL (_read-eval-print-loop_) in the browser  
//  The document is a list of input/output pairs.  
//  The last item in the document is an input element.  
//  On enter we eval and append a new input/output pair.

function Repl (elem, eval_, preview) {
	var history = [], hpos = -1 // Application state: selected history item
		, elem, prompt, ta, span  // References to the UI (DOM) elements.
		, codeArea
		, keymap = { 3:enter, 13:enter, 38:up, 40:down }
		, self = { exec:exec, clear:clear, focus:focus }
	return _init()

	function focus () {
		return ta.focus () }

	function exec (input, _save) {
		if (_save !== false) 
			hpos = history.push(input)-1 // Store history item
		var output = eval_(input)
		if (output && output.type === 'html_raw')
			_append (input, output.value, 'html')
		else
			_append (input, output)
		var d = document, b = d.body
		window.pageYOffset = d.documentElement.scrollTop = b.scrollTop = b.clientHeight /* scroll into view */ } // FIXME

	function clear () {
		elem.innerHTML = ta.value = ''
		elem.appendChild(prompt)
		ta.focus() }

	function up () {
		var value = (hpos >= 0) ? history[hpos--] : ''
		codeArea.reset({ text:value, cursor:value.length }) }

	function down () {
		var value = (hpos+1 < history.length) ? history[++hpos] : ''
		codeArea.reset({ text:value, cursor:value.length }) }

	function enter () {
		var input = codeArea.get().text
		codeArea.reset({text:'', cursor:0})
		//var input = ta.value; ta.value = '';
		return exec(input) }

	// Append an input-output pair to the repl/ log

	function _append (input, output, encoding) {
		var div = document.createElement('DIV')
		span.firstChild.data = ''
		if (encoding === 'html') {
			div.innerHTML = '\t<pre class="input"></pre>\n\t<div></div>\n'
			div.childNodes[3].innerHTML = output }
		else {
			div.innerHTML = '\t<pre class="input"></pre>\n\t<pre class="output"></pre>\n'
			div.childNodes[3].appendChild(document.createTextNode(output)) }
		div.childNodes[1].appendChild(codeArea.print(input))
		elem.insertBefore(div, prompt) }

	//function _oninput () {
	//	span.firstChild.data = preview(codeArea.get().text) }

	function _keydown (evt) {
		if (typeof keymap[evt.keyCode] === 'function') {
			evt.preventDefault()
			keymap[evt.keyCode]() } }

	function _init () {
		elem.innerHTML = '<div class="prompt"><pre contenteditable=true></pre><span cass="preview"> </span></div>'
		prompt = elem.childNodes[0]
		ta = prompt.childNodes[0]
		span = prompt.childNodes[1]
		codeArea = new CodeArea(ta, CodeArea.modes.js)
		ta.onkeydown = _keydown
		// if (typeof preview === 'function')
		// 	ta.oninput = _oninput
		elem.onclick = focus
		return self  }
}

//module.exports = Repl
//})()