type Grid = string[][]

type Defaults = {
	single: Sync.MoveLayout
	double: Sync.MoveLayout
	triple: Sync.MoveLayout
}

const MOVE_WIDGETS = ['time', 'main', 'quicklinks', 'notes', 'quotes', 'searchbar']

export const elements = <const>{
	time: document.getElementById('time'),
	main: document.getElementById('main'),
	quicklinks: document.getElementById('linkblocks'),
	searchbar: document.getElementById('sb_container'),
	notes: document.getElementById('notes_container'),
	quotes: document.getElementById('quotes_container'),
}

export const defaultLayouts: Defaults = {
	single: {
		grid: [['time'], ['main'], ['quicklinks']],
		items: {},
	},
	double: {
		grid: [
			['time', '.'],
			['main', '.'],
			['quicklinks', '.'],
		],
		items: {},
	},
	triple: {
		grid: [
			['.', 'time', '.'],
			['.', 'main', '.'],
			['.', 'quicklinks', '.'],
		],
		items: {},
	},
}

export function isEditing(): boolean {
	return document.getElementById('interface')?.classList.contains('move-edit') || false
}

export function hasDuplicateInArray(arr: string[], id?: string): boolean {
	return arr.filter((a) => a === id).length > 1
}

export function getLayout(move: Sync.Move | Sync.Storage, selection?: Sync.MoveSelection): Sync.MoveLayout {
	move = (move as Sync.Storage)?.move ? (move as Sync.Storage).move : (move as Sync.Move)
	selection = selection ?? move.selection

	return move.layouts?.[selection] ?? defaultLayouts[selection]
}

//	Grid

function gridValidate(grid: Grid): boolean {
	const cells = grid.flat()
	const cellsAreWidgets = cells.every((val) => val === '.' || MOVE_WIDGETS.includes(val))
	return cellsAreWidgets
}

export function gridParse(area = ''): Grid {
	const stringToGrid = (split: string): string[][] => {
		let rows = area.split(split).filter((a) => a.length > 1)
		let grid = rows.map((r) => r.split(' '))
		return grid
	}

	const result = stringToGrid("'")

	if (gridValidate(result)) {
		return result
	} else {
		return stringToGrid(`\"`)
	}
}

export function gridStringify(grid: Grid) {
	let areas = ``

	const itemListToString = (row: string[]) => row.reduce((a, b) => `${a} ${b}`) // 2
	grid.forEach((row: string[]) => (areas += `'${itemListToString(row)}' `)) // 1

	return areas.trimEnd()
}

export function gridFind(grid: Grid, id: string): [number, number][] {
	const positions: [number, number][] = []

	grid.flat().forEach((a, i) => {
		if (a !== id) return

		const column = i % grid[0].length
		const row = Math.floor(i / grid[0].length)

		positions.push([column, row])
	})

	return positions
}

//	Alignment

export function alignStringify(align: { box: string; text: string }): string {
	return align.box + (align.box && align.text ? ' & ' : '') + align.text
}

export function alignParse(string = ''): { box: string; text: string } {
	const arr = string.split(' & ')
	return { box: arr[0] ?? '', text: arr[1] ?? '' }
}

//	Span

function getSpanDirection(grid: Grid, id: string): 'none' | 'columns' | 'rows' {
	const poses = gridFind(grid, id)
	const rows = Object.values(poses).map(([_, row]) => row)

	if (poses.length < 2) return 'none'
	if (rows[0] !== rows[1]) return 'columns'
	else return 'rows'
}

export function isRowEmpty(grid: Grid, index: number) {
	if (grid[index] === undefined) return false

	let row = grid[index]
	let empty = true

	row.forEach((cell) => {
		if (cell !== '.' && getSpanDirection(grid, cell) !== 'columns') {
			empty = false
		}
	})

	return empty
}

export function spansInGridArea(grid: Grid, id: Widgets, { toggle, remove }: { toggle?: 'row' | 'col'; remove?: true }) {
	function addSpans(arr: string[]) {
		let target = arr.indexOf(id)
		let stopper = [false, false]

		function replaceWithId(a: string[], i: number, lim: number) {
			// not stopping and elem exit
			if (!stopper[lim] && a[i]) {
				if (a[i] === '.') a[i] = id // replaces dot with id
				else if (a[i] !== id) stopper[lim] = true // other ? stop
			}

			return a
		}

		// in [., a, ., ., target, ., b, ., .]
		for (let ii = 1; ii < arr.length; ii++) {
			arr = replaceWithId(arr, target + ii, 0) // replaces until b
			arr = replaceWithId(arr, target - ii, 1) // replaces until a
		}

		return arr
	}

	function removeSpans(arr: string[]) {
		let keepfirst = true
		return arr.map((a) => {
			if (a === id) {
				if (keepfirst) keepfirst = false
				else return '.'
			}
			return a
		})
	}

	/*
		For columns and rows:
		mutate column by adding / removing duplicates 
		mutate grid with new column
		update buttons with recheck duplication (don't assume duped work everytime) 
	*/

	const [x, y] = gridFind(grid, id)[0]
	let col = grid.map((g) => g[x])
	let row = [...grid[y]]

	if (remove) {
		col = removeSpans(col)
		row = removeSpans(row)
	}

	if (toggle) {
		if (toggle === 'col') col = hasDuplicateInArray(col, id) ? removeSpans(col) : addSpans(col)
		if (toggle === 'row') row = hasDuplicateInArray(row, id) ? removeSpans(row) : addSpans(row)
	}

	grid.forEach((_, i) => (grid[i][x] = col[i])) // Row changes
	grid[y].forEach((_, i) => (grid[y][i] = row[i])) // Column changes

	return grid
}

//	Widgets

export function getWidgetsStorage(data: Sync.Storage): Widgets[] {
	// BAD: DO NOT CHANGE THIS OBJECT ORDER AS IT WILL BREAK LAYOUT RESET
	// Time & main in first place ensures grid size is enough to add quotes & links
	let displayed = {
		time: data.time,
		main: data.main,
		notes: !!data.notes?.on,
		searchbar: !!data.searchbar?.on,
		quicklinks: data.quicklinks,
		quotes: !!data.quotes?.on,
	}

	return Object.entries(displayed)
		.filter(([_, val]) => val)
		.map(([key, _]) => key as Widgets)
}

export function updateWidgetsStorage(states: [Widgets, boolean][], data: Sync.Storage): Sync.Storage {
	//
	for (const [id, on] of states) {
		if (id === 'time') data.time = on
		if (id === 'main') data.main = on
		if (id === 'quicklinks') data.quicklinks = on
		if (id === 'quotes') data.quotes = { ...data.quotes, on: on }
		if (id === 'searchbar') data.searchbar = { ...data.searchbar, on: on }
		if (id === 'notes' && data.notes) data.notes = { ...data.notes, on: on }
	}

	return data
}

export function getGridWidgets(area: string): Widgets[] {
	const list = area.replaceAll("'", '').replaceAll('.', '').split(' ')
	const widgets = list.filter((str, i) => str && list.indexOf(str) === i) // remove duplicates
	return widgets as Widgets[]
}

export function addGridWidget(grid: string, id: Widgets, selection: Sync.MoveSelection): string {
	const newrow = addGridRow(selection, id)
	let rows = grid.split("'").filter((row) => !(row === ' ' || row === ''))
	let position = 0

	if (grid === '') {
		return `'${newrow}'`
	}

	const isFirstWidgetTime = rows[0].includes('time')
	const isLastWidgetQuotes = rows.at(-1)?.includes('quotes')

	if (id === 'time') position = 0
	if (id === 'main') position = isFirstWidgetTime ? 1 : 0
	if (id === 'notes') position = rows.length === 1 ? 1 : 2
	if (id === 'searchbar') position = rows.length === 1 ? 1 : 2
	if (id === 'quicklinks') position = rows.length - (isLastWidgetQuotes ? 1 : 0)
	if (id === 'quotes') position = rows.length

	rows.splice(position, 0, newrow)
	rows = rows.map((row) => `'${row}'`)
	grid = rows.join(' ')

	return grid
}

export function removeGridWidget(grid: string, id: Widgets, _: Sync.MoveSelection): string {
	let rows = grid.split("'").filter((row) => !(row === ' ' || row === ''))

	rows = rows.filter((row) => !row.includes(id))
	rows = rows.map((row) => `'${row}'`)
	grid = rows.join(' ')

	return grid
}

function addGridRow(selection: Sync.MoveSelection, id: Widgets): string {
	const firstcolumn = selection === 'triple' ? '. ' : ''
	const lastcolumn = selection === 'triple' || selection === 'double' ? ' .' : ''

	return `${firstcolumn}${id}${lastcolumn}`
}
