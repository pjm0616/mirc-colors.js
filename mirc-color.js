// Copyright (C) 2015 Park, Jeongmin <pjm0616@gmail.com>
// Licensed under the MIT license.

(function() {
	'use strict';

	function cloneDict(obj) {
		if (typeof obj === 'object') {
			var obj2 = {};
			var keys = Object.keys(obj);
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i];
				obj2[key] = obj[key];
			}
			return obj2;
		} else {
			return obj;
		}
	}

	function htmlentities(text) {
		var div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	// This regexp doesn't care about mirc colors and treat them like regular chars.
	var urlRegexp = new RegExp('(https?|ftp)://[^\\s/$.?#].[^\\s]*', 'ig');

	var mircColorRegexp = new RegExp('(?:[\x02\x1f\x0f\x16]+|\x03[0-9]{0,2}(?:,[0-9]{0,2})?)*', 'g');
	function stripMircColors(text) {
		return text.replace(mircColorRegexp, '');
	}

	// From: http://www.mirc.com/colors.html
	var mircColorCodes = {
		0: ['White', [255,255,255]],
		1: ['Black', [0,0,0]],
		2: ['Blue', [0,0,127]],
		3: ['Green', [0,147,0]],
		4: ['Light Red', [255,0,0]],
		5: ['Brown', [127,0,0]],
		6: ['Purple', [156,0,156]],
		7: ['Orange', [252,127,0]],
		8: ['Yellow', [255,255,0]],
		9: ['Light Green', [0,252,0]],
		10: ['Cyan', [0,147,147]],
		11: ['Light Cyan', [0,255,255]],
		12: ['Light Blue', [0,0,252]],
		13: ['Pink', [255,0,255]],
		14: ['Grey', [127,127,127]],
		15: ['Light Grey', [210,210,210]],
		// FIXME
		'default-fgcolor': ['default-fgcolor', [0,0,0]],
		'default-bgcolor': ['default-bgcolor', [255,255,255]],
	};
	function resolveIrcColor(colorCode) {
		var entry = mircColorCodes[colorCode];
		if (!entry) {
			return '#000000';
		}
		var rgb = entry[1];
		var color = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
		var hex = color.toString(16);
		return '#' + ('000000' + hex).substr(-6);
	}

	function mircColorToHtml(input, options) {
		var INITIAL_STATE = {
			bold: false,
			underline: false,
			fgcolor: false,
			bgcolor: false,
			link: false,
		};

		if (options === undefined) {
			options = {};
		}

		var state = cloneDict(INITIAL_STATE);
		var stateStack = [];
		function updateStateInternal(newState) {
			var stateEn = {};
			var stateChangeList = [];

			// Sanitize newState into newState2.
			var newState2 = {};
			var keys = Object.keys(newState);
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i], value = newState[key], oldValue = state[key];

				if (value === 'toggle') {
					value = !oldValue;
				}
				if (value === oldValue) {
					continue;
				}
				newState2[key] = value;
			}

			// Calculate stateEn and stateChangeList.
			var keys = Object.keys(newState2);
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i], value = newState2[key];

				if (value) {
					stateEn[key] = value;
				}
				// We need to pop previous state if:
				// 1) It was on and we're going to turn it off: value === false (obviously state[key] !== false in this case).
				// 2) It was on and we're going to change its value: value !== false && state[key] !== false
				if (state[key] !== false) {
					for (var j = stateStack.length - 1; j >= 0; j--) {
						var popped = stateStack.pop();
						var origValue = state[popped];
						state[popped] = false;
						stateChangeList.push([popped, false]);

						if (popped === key) {
							break;
						} else if (newState2[popped] === undefined) {
							// We have to reenable this state.
							stateEn[popped] = origValue;
						}
					}
				}
			}

			// Update remaining state and stateChangeList.
			var keys = Object.keys(stateEn);
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i], value = stateEn[key];

				state[key] = value;
				stateStack.push(key);
				stateChangeList.push([key, value]);
			}

			return stateChangeList;
		} // END OF updateStateInternal()

		var charBuf = []; // Temp string fragment buffer.
		var result = [];
		function updateState(newState) {
			if (charBuf.length > 0) {
				var s = htmlentities(charBuf.join(''));
				result.push(s);
				charBuf = [];
			}

			var changeList = updateStateInternal(newState);
			for (var i = 0; i < changeList.length; i++) {
				var key = changeList[i][0], value = changeList[i][1];
				result.push(getHtmlTag(key, value));
			}
		} // END OF updateState()

		function getHtmlTag(key, value) {
			if (key === 'bold') {
				return value ? '<strong>' : '</strong>';
			} else if (key === 'underline') {
				return value ? '<span style="text-decoration: underline">' : '</span>';
			} else if (key === 'fgcolor') {
				return (value !== false) ? '<span style="color: ' + resolveIrcColor(value) + '">' : '</span>';
			} else if (key === 'bgcolor') {
				return (value !== false) ? '<span style="background-color: ' + resolveIrcColor(value) + '">' : '</span>';
			} else if (key === 'link') {
				return (value !== false) ? '<a href="' + htmlentities(value) + '">' : '</a>';
			}
		} // END OF getHtmlTag()


		// Search for URLs.
		var urlIndices = {};
		if (options.createLinks) {
			var m;
			while ((m = urlRegexp.exec(input)) !== null) {
				urlIndices[m.index] = m[0].length;
			}
		}

		// Convert the input.
		for (var i = 0; i < input.length; i++) {
			var ch = input[i];
			if (ch === '\x02') {
				updateState({bold: 'toggle'});
			} else if (ch === '\x1f') {
				updateState({underline: 'toggle'});
			} else if (ch === '\x0f') {
				updateState({bold: false, underline: false, fgcolor: false, bgcolor: false});
			} else if (ch === '\x16') {
				// Swap fgcolor and bgcolor.
				// default-(bg|fg)color is a magic constant that represent the default bg/fg colors.
				var fgcolor = state['bgcolor'] || 'default-bgcolor';
				var bgcolor = state['fgcolor'] || 'default-fgcolor';
				if (fgcolor === 'default-fgcolor') {
					fgcolor = false;
				}
				if (bgcolor === 'default-bgcolor') {
					bgcolor = false;
				}
				updateState({fgcolor: fgcolor, bgcolor: bgcolor});
			} else if (ch === '\x03') {
				var j = i + 1;
				var flag = 0;
				while (j < input.length) {
					if (input[j] >= '0' && input[j] <= '9' && (j - i) <= 2) {
						j++;
					} else {
						if (flag === 0) {
							if (j > i) {
								updateState({fgcolor: parseInt(input.substring(i + 1, j))});
								if (input[j] === ',') {
									i = j;
									j++;
									flag = 1;
									continue;
								}
							}
						} else {
							if (j > i) {
								updateState({bgcolor: parseInt(input.substring(i + 1, j))});
							}
						}
						j--;
						break;
					}
				}
				i = j;
			} else {
				// Handle URLs.
				if (state['link'] === false) {
					var urlLength = urlIndices[i];
					if (urlLength !== undefined) {
						var url = stripMircColors(input.substr(i, urlLength));

						var origState = cloneDict(state);
						// Since we don't want links to be split, we put the link tag at the top.
						// Reset the state to the initial state first.
						updateState(INITIAL_STATE);
						// And add the link tag.
						updateState({link: url});
						// And then restore the previous state, with the link.
						origState['link'] = url;
						updateState(origState);

						var urlEndPos = i + urlLength;
					}
				} else {
					if (i === urlEndPos) {
						updateState({link: false});
					}
				}

				// Add the character to the buffer.
				charBuf.push(ch);
			}
		}

		updateState(INITIAL_STATE);
		return result.join('');
	}


	if (typeof this === 'object') {
		this.stripMircColors = stripMircColors;
		this.mircColorToHtml = mircColorToHtml;
		this.mircColorCodes = mircColorCodes;
		this.resolveIrcColor = resolveIrcColor;
	}
}).call(this);
