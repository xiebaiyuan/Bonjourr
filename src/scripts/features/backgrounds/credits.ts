import { backgroundUpdate } from './index.ts'
import { onclickdown } from 'clickdown/mod'
import { tradThis } from '../../utils/translations.ts'
import { storage } from '../../storage.ts'

import type { Backgrounds } from '../../../types/sync.ts'
import type { Background, BackgroundImage } from '../../../types/shared.ts'

// 用于保存当前的背景图片
let currentBackground: Background | undefined

// 生成详细的文件名，包含各种元数据
function generateDetailedFileName(background?: Background, imageId?: string): string {
	// 基本检查 
	if (!background || background.format !== 'image' || !imageId) {
		return `unsplash-${imageId || 'image'}.jpg`
	}
	
	const img = background as BackgroundImage & { description?: string, alt_description?: string }
	const parts: string[] = []
	
	// 清理字符串，移除非法字符
	const sanitize = (text: string): string => {
		if (!text) return ''
		return text
			.replace(/\s+/g, '-') // 空格替换为短横线
			.replace(/[\\/:*?"<>|]/g, '') // 移除Windows/Unix文件系统非法字符
			.toLowerCase()
			.trim()
	}
	
	// 1. 添加图片名称（如有）
	if (img.name) {
		parts.push(sanitize(img.name))
	}
	
	// 2. 添加图片描述（如有）- 可能存在于扩展属性中
	const description = img.description || img.alt_description || (img as any).desc
	if (description) {
		let shortDesc = sanitize(description)
		// 限制描述长度，避免文件名过长
		if (shortDesc.length > 50) {
			shortDesc = shortDesc.substring(0, 47) + '...'
		}
		parts.push(`desc-${shortDesc}`)
	}
	
	// 2.1 添加创建日期（如有）
	const createdAt = (img as any).created_at
	if (createdAt && typeof createdAt === 'string') {
		try {
			// 尝试解析日期并格式化为YYYY-MM-DD
			const date = new Date(createdAt)
			if (!isNaN(date.getTime())) {
				const formattedDate = date.toISOString().split('T')[0]
				parts.push(`date-${formattedDate}`)
			}
		} catch (e) {
			console.warn('Failed to parse image date:', e)
		}
	}
	
	// 2.2 添加标签信息（如有）
	const tags = (img as any).tags
	if (tags && Array.isArray(tags) && tags.length > 0) {
		// 获取前三个标签
		const topTags = tags.slice(0, 3)
			.map(tag => typeof tag === 'string' ? tag : (tag.title || tag.name))
			.filter(Boolean)
			.map(sanitize)
		
		if (topTags.length > 0) {
			parts.push(`tags-${topTags.join('-')}`)
		}
	}
	

	
	// 4. 添加位置信息（如有）
	if (img.city || img.country) {
		const location: string[] = []
		if (img.city) location.push(sanitize(img.city))
		if (img.country) location.push(sanitize(img.country))
		parts.push(`in-${location.join('-')}`)
	}
	
	// 5. 添加相机和拍摄信息（如有）
	if (img.exif) {
		const exifParts: string[] = []
		
		// 相机品牌和型号
		if (img.exif.make && img.exif.model) {
			exifParts.push(sanitize(`${img.exif.make}-${img.exif.model}`))
		} else if (img.exif.model) {
			exifParts.push(sanitize(img.exif.model))
		}
		
		// 拍摄参数：光圈、快门速度、ISO、焦距
		const technicalParts: string[] = []
		if (img.exif.aperture) technicalParts.push(`f${img.exif.aperture}`)
		if (img.exif.exposure_time) technicalParts.push(`${img.exif.exposure_time}s`)
		if (img.exif.iso) technicalParts.push(`${img.exif.iso}iso`)
		if (img.exif.focal_length) technicalParts.push(`${img.exif.focal_length}mm`)
		
		if (technicalParts.length > 0) {
			exifParts.push(technicalParts.join('-'))
		}
		
		if (exifParts.length > 0) {
			parts.push(`shot-with-${exifParts.join('-')}`)
		}
	}
	
	// 6. 添加摄影师信息（如有）
	if (img.username) {
		parts.push(`by-${sanitize(img.username)}`)
	}
	// 3. 添加图片ID（始终有）
	parts.push(`id-${imageId}`)
	// 7. 添加服务来源
	// parts.push('unsplash')
	
	// 8. 连接所有部分并添加扩展名
	// 限制文件名长度，避免太长
	let fileName = parts.join('_')
	if (fileName.length > 500) { // 大多数文件系统的文件名长度限制在255个字符左右
		// 保留重要部分，删除一些次要信息
		const essentialParts = [
			img.name ? sanitize(img.name).slice(0, 30) : '',
			description ? `desc-${sanitize(description).slice(0, 30)}` : '',
			`id-${imageId}`,
			img.username ? `by-${sanitize(img.username)}` : ''
		].filter(Boolean)
		fileName = essentialParts.join('_')
	}
	
	// 记录生成的文件名
	console.log(`Generated file name: ${fileName}.jpg`, { parts, background })
	
	return `${fileName}.jpg`
}

export function initCreditEvents() {
	onclickdown(document.getElementById('b_interface-background-pause'), () => {
		toggleBackgroundPause()
	})

	onclickdown(document.getElementById('b_interface-background-refresh'), (event) => {
		backgroundUpdate({ refresh: event })
	})

	onclickdown(document.getElementById('b_interface-background-download'), () => {
		downloadCurrentBackground()
	})

	// 初始化点击时钟或天气下载壁纸的功能
	initBackgroundClickToDownload()
}

export function toggleCredits(backgrounds: Backgrounds) {
	const domcontainer = document.getElementById('credit-container')
	const domcredit = document.getElementById('credit')
	const domsave = document.getElementById('a_interface-background-download')

	switch (backgrounds.type) {
		case 'color': {
			domcontainer?.classList.remove('shown')
			return
		}

		case 'urls':
		case 'files': {
			domcontainer?.classList.add('shown')
			domcredit?.classList.add('hidden')
			domsave?.classList.add('hidden')
			break
		}

		case 'videos': {
			domcontainer?.classList.add('shown')
			domcredit?.classList.remove('hidden')
			domsave?.classList.add('hidden')
			break
		}

		default: {
			domcontainer?.classList.add('shown')
			domcredit?.classList.remove('hidden')
			domsave?.classList.remove('hidden')
		}
	}
}

export function updateCredits(image?: Background) {
	const domcontainer = document.getElementById('credit-container')
	const domcredit = document.getElementById('credit')
	const domsave = document.getElementById('download-background')

	if (!(domcontainer && domcredit && image?.page && image?.username)) {
		return
	}

	// 保存当前背景图片以便点击时钟或天气时使用
	currentBackground = image
	
	// 打印背景对象以检查是否存在描述信息和完整的EXIF数据
	console.log('Current background object:', currentBackground)
	
	// 尝试扩展背景图片数据（如果可能）
	if (image && image.format === 'image' && image.download) {
		try {
			// 获取并添加额外的EXIF数据和描述
			enhanceBackgroundData(image as BackgroundImage).catch(e => 
				console.error('Failed to enhance background data:', e)
			)
		} catch (error) {
			console.error('Error enhancing background data:', error)
		}
	}

	if (image?.format === 'video') {
		if (image.username) {
			const dompage = document.createElement('a')
			dompage.textContent = tradThis(`Video by ${image.username}`)
			dompage.href = image.page
			domcredit.textContent = ''
			domcredit.append(dompage)
		}

		return
	}

	const hasLocation = image.city || image.country
	let exif = ''
	let credits = ''

	if (image.exif) {
		const { iso, model, aperture, exposure_time, focal_length } = image.exif

		// ⚠️ In this order !
		if (model) {
			exif += `${model} - `
		}
		if (aperture) {
			exif += `f/${aperture} `
		}
		if (exposure_time) {
			exif += `${exposure_time}s `
		}
		if (iso) {
			exif += `${iso}ISO `
		}
		if (focal_length) {
			exif += `${focal_length}mm`
		}
	}

	if (hasLocation) {
		const city = image.city || ''
		const country = image.country || ''
		const comma = city && country ? ', ' : ''
		credits = `${city}${comma}${country} <name>`
	} else {
		credits = tradThis('Photo by <name>')
	}

	const [location, rest] = credits.split(' <name>')
	const domlocation = document.createElement('a')
	const domspacer = document.createElement('span')
	const domrest = document.createElement('span')
	const domartist = document.createElement('a')
	const domexif = document.createElement('p')

	domexif.className = 'exif'
	domexif.textContent = exif
	domlocation.textContent = location
	domartist.textContent = image.username.slice(0, 1).toUpperCase() + image.username.slice(1)
	domspacer.textContent = hasLocation ? ' - ' : ' '
	domrest.textContent = rest

	if (image.page.includes('unsplash')) {
		domlocation.href = `${image.page}?utm_source=Bonjourr&utm_medium=referral`
		domartist.href = `https://unsplash.com/@${image.username}?utm_source=Bonjourr&utm_medium=referral`
	} else {
		domlocation.href = image.page
	}

	domcredit.textContent = ''
	domcredit.append(domexif, domlocation, domspacer, domartist, domrest)

	if (image.download && domsave) {
		domsave.dataset.downloadUrl = image.download
	}
}

async function toggleBackgroundPause() {
	const freqInput = document.querySelector<HTMLSelectElement>('#i_freq')
	const button = document.getElementById('b_interface-background-pause')
	const paused = button?.classList.contains('paused')
	const sync = await storage.sync.get('backgrounds')
	const last = localStorage.lastBackgroundFreq || 'hour'

	if (freqInput) {
		freqInput.value = paused ? last : 'pause'
	}

	if (paused) {
		backgroundUpdate({ freq: last })
	} else {
		localStorage.lastBackgroundFreq = sync.backgrounds.frequency
		backgroundUpdate({ freq: 'pause' })
	}
}

// 通用的下载当前背景图片函数
async function downloadCurrentBackground() {
	// 检查当前是否有背景图片可下载
	if (!currentBackground || currentBackground.format !== 'image' || !currentBackground.download) return
	
	// 获取悬浮下载按钮并设置加载状态
	const dombutton = document.querySelector<HTMLButtonElement>('#b_interface-background-download')
	dombutton?.classList.replace('idle', 'loading')
	
	// 创建下载提示
	const loadingToast = createToast(tradThis('Downloading wallpaper...'), 'info')
	
	// 尝试在下载前增强背景数据以获取更多元数据
	try {
		// 异步增强数据，但不等待完成（以避免下载延迟）
		enhanceBackgroundData(currentBackground as BackgroundImage)
	} catch (error) {
		console.warn('Failed to enhance background data before download:', error)
	}
	
	try {
		const baseUrl = 'https://services.bonjourr.fr/unsplash'
		const downloadUrl = new URL(currentBackground.download)
		const apiDownloadUrl = baseUrl + downloadUrl.pathname + downloadUrl.search
		const downloadResponse = await fetch(apiDownloadUrl)
		
		if (!downloadResponse) {
			if (document.body.contains(loadingToast)) {
				document.body.removeChild(loadingToast)
			}
			dombutton?.classList.replace('loading', 'idle')
			createToast(tradThis('Download failed'), 'error')
			return
		}
		
		const data: { url: string } = await downloadResponse.json()
		
		// 优化下载质量和格式
		const photoUrl = new URL(data.url)
		photoUrl.searchParams.set('q', '100')
		photoUrl.searchParams.set('fm', 'jpg')
		photoUrl.searchParams.set('raw', 'true')
		photoUrl.searchParams.set('fit', 'max')
		photoUrl.searchParams.set('metadata', 'true')
		
		const imageResponse = await fetch(photoUrl.toString())
		
		if (!imageResponse.ok) {
			if (document.body.contains(loadingToast)) {
				document.body.removeChild(loadingToast)
			}
			dombutton?.classList.replace('loading', 'idle')
			createToast(tradThis('Download failed'), 'error')
			return
		}
		
		const blob = await imageResponse.blob()
		
		// 提取图片ID
		const imageId = downloadUrl.pathname.split('/')[2]
		// 构建详细的文件名
		const fileName = generateDetailedFileName(currentBackground, imageId)
		console.log('Generated detailed filename:', fileName)
		
		// 创建下载链接并触发下载
		const downloadLink = document.createElement('a')
		downloadLink.href = URL.createObjectURL(blob)
		downloadLink.download = fileName
		document.body.appendChild(downloadLink)
		downloadLink.click()
		document.body.removeChild(downloadLink)
		
		// 移除加载提示并显示成功提示
		if (document.body.contains(loadingToast)) {
			document.body.removeChild(loadingToast)
		}
		dombutton?.classList.replace('loading', 'idle')
		createToast(tradThis('Download started!'), 'success', true)
	} catch (error) {
		console.error('Failed to download image:', error)
		if (document.body.contains(loadingToast)) {
			document.body.removeChild(loadingToast)
		}
		dombutton?.classList.replace('loading', 'idle')
		createToast(tradThis('Download failed'), 'error')
	}
}

async function downloadImage() {
	const dombutton = document.querySelector<HTMLButtonElement>('#b_interface-background-download')
	const domsave = document.querySelector<HTMLAnchorElement>('#download-background')

	if (!domsave) {
		console.warn('Download element not found')
		return
	}

	dombutton?.classList.replace('idle', 'loading')
	const loadingToast = createToast(tradThis('Downloading wallpaper...'), 'info')
	
	// 尝试在下载前增强背景数据以获取更多元数据
	if (currentBackground?.format === 'image') {
		try {
			// 异步增强数据，但不等待完成（以避免下载延迟）
			enhanceBackgroundData(currentBackground as BackgroundImage)
		} catch (error) {
			console.warn('Failed to enhance background data before download:', error)
		}
	}

	try {
		const baseUrl = 'https://services.bonjourr.fr/unsplash'
		const downloadUrl = new URL(domsave.dataset.downloadUrl ?? '')
		const apiDownloadUrl = baseUrl + downloadUrl.pathname + downloadUrl.search
		const downloadResponse = await fetch(apiDownloadUrl)

		if (!downloadResponse) {
			if (document.body.contains(loadingToast)) {
				document.body.removeChild(loadingToast)
			}
			createToast(tradThis('Download failed'), 'error')
			return
		}

		const data: { url: string } = await downloadResponse.json()
		
		// 优化下载质量和格式
		const photoUrl = new URL(data.url)
		photoUrl.searchParams.set('q', '100')
		photoUrl.searchParams.set('fm', 'jpg')
		photoUrl.searchParams.set('raw', 'true')
		photoUrl.searchParams.set('fit', 'max')
		photoUrl.searchParams.set('metadata', 'true')

		const imageResponse = await fetch(photoUrl.toString())

		if (!imageResponse.ok) {
			if (document.body.contains(loadingToast)) {
				document.body.removeChild(loadingToast)
			}
			createToast(tradThis('Download failed'), 'error')
			return
		}

		const blob = await imageResponse.blob()
		
		// 提取图片ID
		const imageId = downloadUrl.pathname.split('/')[2]
		// 构建详细的文件名
		const fileName = generateDetailedFileName(currentBackground, imageId)
		console.log('Generated detailed filename:', fileName)

		domsave.href = URL.createObjectURL(blob)
		domsave.download = fileName
		domsave.click()
		
		// 移除加载提示并显示成功提示
		if (document.body.contains(loadingToast)) {
			document.body.removeChild(loadingToast)
		}
		createToast(tradThis('Download started!'), 'success', true)
	} catch (error) {
		console.error('Failed to download image:', error)
		if (document.body.contains(loadingToast)) {
			document.body.removeChild(loadingToast)
		}
		createToast(tradThis('Download failed'), 'error', true)
	} finally {
		dombutton?.classList.replace('loading', 'idle')
	}
}

// 创建一个优雅的下载提示器
function createToast(message: string, type: 'info' | 'success' | 'error' = 'info', autoHide = true) {
	const toast = document.createElement('div')
	toast.className = `bjr-toast bjr-toast-${type}`
	
	// 创建图标元素
	const icon = document.createElement('span')
	icon.className = 'bjr-toast-icon'
	
	// 根据类型设置不同图标（使用简单的 Unicode 字符）
	switch (type) {
		case 'info':
			icon.innerHTML = '&#8505;' // ℹ 信息图标
			break
		case 'success':
			icon.innerHTML = '&#10004;' // ✓ 成功图标
			break
		case 'error':
			icon.innerHTML = '&#10060;' // ❌ 错误图标
			break
	}
	
	// 创建消息元素
	const messageEl = document.createElement('span')
	messageEl.className = 'bjr-toast-message'
	messageEl.textContent = message
	
	// 组装提示元素
	toast.appendChild(icon)
	toast.appendChild(messageEl)
	
	// 添加样式
	const styles = {
		position: 'fixed',
		bottom: '20px',
		right: '20px',
		padding: '8px 12px',
		background: 'rgba(0,0,0,0.5)',
		color: 'white',
		borderRadius: '4px',
		fontSize: '12px',
		zIndex: '9999',
		display: 'flex',
		alignItems: 'center',
		gap: '6px',
		backdropFilter: 'blur(5px)',
		boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
		opacity: '0',
		transform: 'translateY(10px)',
		transition: 'opacity 0.3s ease, transform 0.3s ease'
	}
	
	// 应用样式
	Object.entries(styles).forEach(([key, value]) => {
		toast.style[key as any] = value
	})
	
	// 添加到文档
	document.body.appendChild(toast)
	
	// 触发动画（在下一个微任务中执行以确保DOM已更新）
	setTimeout(() => {
		toast.style.opacity = '1'
		toast.style.transform = 'translateY(0)'
	}, 10)
	
	// 如果设置了自动隐藏，则在指定时间后移除
	if (autoHide) {
		setTimeout(() => {
			// 开始淡出动画
			toast.style.opacity = '0'
			toast.style.transform = 'translateY(10px)'
			
			// 动画结束后移除元素
			setTimeout(() => {
				if (document.body.contains(toast)) {
					document.body.removeChild(toast)
				}
			}, 300) // 等待动画完成
		}, type === 'error' ? 4000 : 3000) // 错误提示显示稍长一些
	}
	
	return toast
}

// 添加点击时钟或天气下载壁纸的功能
function initBackgroundClickToDownload() {
	const triggerElements = [
		document.getElementById('time'),
		document.getElementById('weather')
	]

	triggerElements.forEach(element => {
		if (!element) return
		
		element.addEventListener('click', async () => {
			await downloadCurrentBackground()
		})
	})
}

// 获取图片的详细元数据
async function enhanceBackgroundData(image: BackgroundImage): Promise<void> {
	if (!image.download) return
	
	try {
		// 使用Bonjourr代理服务获取更多Unsplash图片元数据
		const imageId = image.download.split('/').filter(Boolean).pop()
		if (!imageId) return
		
		// 尝试请求图片的详细信息
		const response = await fetch(`https://services.bonjourr.fr/unsplash/photos/${imageId}`)
		if (!response.ok) {
			console.warn('Failed to fetch additional image metadata')
			return
		}
		
		const photoData = await response.json()
		console.log('Enhanced photo data:', photoData)
		
		// 扩展当前背景信息
		if (photoData) {
			// 添加描述信息
			if (photoData.description && typeof photoData.description === 'string') {
				(image as any).description = photoData.description
			}
			if (photoData.alt_description && typeof photoData.alt_description === 'string') {
				(image as any).alt_description = photoData.alt_description
			}
			
			// 添加更多EXIF信息
			if (photoData.exif && image.exif) {
				// 扩展现有的EXIF对象
				if (photoData.exif.make && !image.exif.make) {
					image.exif.make = photoData.exif.make
				}
				
				// 添加额外的EXIF信息
				if (photoData.exif) {
					Object.entries(photoData.exif).forEach(([key, value]) => {
						// 只添加不存在的键
						if (value !== null && value !== undefined && !(key in image.exif!)) {
							(image.exif as any)[key] = value
						}
					})
				}
			} else if (photoData.exif && !image.exif) {
				// 如果之前没有EXIF对象，则创建一个
				image.exif = photoData.exif
			}
			
			// 更新日期信息（如果有）
			if (photoData.created_at) {
				(image as any).created_at = photoData.created_at
			}
			
			// 更新标签信息（如果有）
			if (photoData.tags && Array.isArray(photoData.tags)) {
				(image as any).tags = photoData.tags
			}
		}
		
		// 保存更新后的背景图片对象
		currentBackground = image
		console.log('Background data enhanced with additional metadata', image)
	} catch (error) {
		console.error('Error fetching image metadata:', error)
	}
}
