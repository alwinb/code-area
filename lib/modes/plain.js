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