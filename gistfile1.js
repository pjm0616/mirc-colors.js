function parseIrcColor(s) {
	var state = {
		bold: false,
		underline: false,
		color: false,
		bgcolor: false,
	};
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
			} else {
				for (var j = stateStack.length - 1; j >= 0; j--) {
					var popped = stateStack.pop();
					state[key] = false;
					stateChangeList.push([popped, false]);

					if (popped === key) {
						break;
					} else if (newState2[popped] === undefined) {
						// We have to reenable this state.
						stateEn[popped] = state[popped];
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

	var charBuf = [];
	var result = [];
	function updateState(newState) {
		if (charBuf.length > 0) {
			result.push(charBuf.join(''));
			charBuf = [];
		}

		var changeList = updateStateInternal(newState);
		for (var i = 0; i < changeList.length; i++) {
			var key = changeList[i][0], value = changeList[i][1];
			result.push(getHtmlTag(key, value));
		}
	} // END OF updateState()

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

	function getHtmlTag(key, value) {
		if (key === 'bold') {
			return value ? '<strong>' : '</strong>';
		} else if (key === 'underline') {
			return value ? '<span style="text-decoration: underline">' : '</span>';
		} else if (key === 'color') {
			return (value !== false) ? '<span style="color: ' + resolveIrcColor(value) + '">' : '</span>';
		} else if (key === 'bgcolor') {
			return (value !== false) ? '<span style="background-color: ' + resolveIrcColor(value) + '">' : '</span>';
		}
	} // END OF getHtmlTag()

	// Process the input.
	for (var i = 0; i < s.length; i++) {
		var ch = s[i];
		if (ch === '\x02') {
			updateState({bold: 'toggle'});
		} else if (ch === '\x1f') {
			updateState({underline: 'toggle'});
		} else if (ch === '\x0f') {
			updateState({bold: false, underline: false, color: false, bgcolor: false});
		} else if (ch === '\x03') {
			var j = i + 1;
			var flag = 0;
			while (j < s.length) {
				if (s[j] >= '0' && s[j] <= '9' && (j - i) <= 2) {
					j++;
				} else {
					if (flag === 0) {
						if (j > i) {
							updateState({color: parseInt(s.substring(i + 1, j))});
							if (s[j] === ',') {
								i = j;
								j++;
								flag = 1;
								continue;
							}
						}
					} else {
						if (j > i) {
							updateState({bgcolor: parseInt(s.substring(i + 1, j))});
						}
					}
					j--;
					break;
				}
			}
			i = j;
		} else {
			charBuf.push(s[i]);
		}
	}

	updateState({bold: false, underline: false, color: false, bgcolor: false});
	return result.join('');
}
