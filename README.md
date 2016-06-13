Editable code area
==================

Convert any DOM element (with or without content) into a code area. 
The code is editable if the original DOM element has contenteditable=true. 

* Small code size, no libraries
* Arbitrary styles, including non-monospace fonts and different line heights
* Just for quick demos, editing small pieces of code. For serious things, use CodeMirror

Demos
-----

* [Area](http://alwinb.github.io/code-area/demo.html)
* [Repl](http://alwinb.github.io/code-area/repl.html)

How did you do that?
--------------------

After every 'contenteditable' edit the editor parses the html content of the element to a very simple internal document representation: just a string and a cursor position, that's all. 
After the parse, the lexer is run on the string, and new html is generated, with spans wrapping each of the tokens, meanwhile translating the cursor position to a DOM selection. 

