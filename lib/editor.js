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

function readDom (elem) {
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

function render (model, mode, elem) {
	var doc = elem.ownerDocument
	var frag = doc.createDocumentFragment()
	var tokens = new mode (model.text)
		, last = tokens.info().position
		, tok = tokens.next()
		, next
		, sel = { node:elem, offset:0 }

	while (tok !== null) {
		next = tokens.info().position
		var span = toSpan(tok, doc)
		frag.appendChild(span)
		if (last < model.cursor && next >= model.cursor)
			sel = { node:span.firstChild, offset:model.cursor-last }
		last = next
		tok = tokens.next()
	}
	return { fragment:frag, selection:sel }
}

// sel is an object { node:domNode, offset:number }
function _setSelection (sel, window) {
	var doc = window.document
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
		, timeout

	element.spellcheck = false
	elem.addEventListener('keydown', onkeydown)
	reset(readDom(elem))
	var evs = ['input', 'keyup', 'cut', 'paste']
	for (var i=0,l=evs.length; i<l; i++)
		elem.addEventListener(evs[i], ondomchanged)

	return { get:get, set:set, undo:undo, redo:redo, reset:reset, setMode:setMode, print:print, focus:focus }

	function focus () {
		return elem.focus() }

	function reset (model) {
		undo_stack = [model]
		undo_index = 0
		draw() }

	function setMode (mode_) {
		mode = mode_
		draw() }

	function undo () {
		if (undo_index > 0) {
			undo_index--
			draw() } }

	function redo () {
		if (undo_index+1 < undo_stack.length) {
			undo_index++
			draw() } }

	function get () {
		return undo_stack[undo_index] }

	function set (model) {
		var _model = get()
		if (!_model || model.text !== _model.text) {
			undo_stack = undo_stack.slice(0, undo_index+1)
			undo_index += 1
			undo_stack[undo_index] = model
			draw() }
		undo_stack[undo_index] = model }


	// Private

	function insert (snippet) {
		var model = readDom(elem)
		var t = model.text, a = model.cursor
		var t = t.slice(0, a)+snippet+t.slice(a)
		set ({ text:t, cursor:a+snippet.length })
	}

	function setFromDom () {
		clearTimeout (timeout)
		set(readDom(elem))
	}

	function ondomchanged () {
		clearTimeout (timeout)
		timeout = setTimeout (setFromDom, 75)
	}

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

	function draw () {
		var dom = render (get(), mode, elem)
		while (elem.lastChild)
			elem.removeChild(elem.lastChild)
		elem.appendChild(dom.fragment) 
		_setSelection(dom.selection, window)
	}
	
	function print (text, mode_) {
		var dom = render ({text:text, anchor:0}, mode_ ? mode_ : mode, elem)
		return dom.fragment
	}

}

var keymap = 
	{ 9:'Tab', 3:'Enter', 13:'Enter', 89:'Y', 90:'Z', 38:'Up', 40:'Down' }

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