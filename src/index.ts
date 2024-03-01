import '@kitware/vtk.js/Rendering/Profiles/All'
import vtkGenericRenderWindow from "@kitware/vtk.js/Rendering/Misc/GenericRenderWindow"
import vtkRenderer from "@kitware/vtk.js/Rendering/Core/Renderer"
import vtkRenderWindow from "@kitware/vtk.js/Rendering/Core/RenderWindow"
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper'
import DataAccessHelper from '@kitware/vtk.js/IO/Core/DataAccessHelper'
import HttpDataAccessHelper from '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper'
import {niftiReadImage} from "@itk-wasm/image-io"
import vtkITKHelper from "@kitware/vtk.js/Common/DataModel/ITKHelper"
import vtkImageData from "@kitware/vtk.js/Common/DataModel/ImageData"
import vtkImageSlice from "@kitware/vtk.js/Rendering/Core/ImageSlice"
import vtkInteractorStyleImage from "@kitware/vtk.js/Interaction/Style/InteractorStyleImage"
import vtkImageResliceMapper from "@kitware/vtk.js/Rendering/Core/ImageResliceMapper"
import vtkPlane from "@kitware/vtk.js/Common/DataModel/Plane"
import {SlabTypes} from "@kitware/vtk.js/Rendering/Core/ImageResliceMapper/Constants"
import {Vector3} from "@kitware/vtk.js/types"
import vtkOutlineFilter from "@kitware/vtk.js/Filters/General/OutlineFilter"
import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor"
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper"

const niftiFile = 'cadera.nii.gz'
const niftiUrl = `/public/${niftiFile}`

let imageData: vtkImageData
let renderer: vtkRenderer
let renderWindow: vtkRenderWindow
let renderer3d: vtkRenderer
let renderWindow3d: vtkRenderWindow

let planeNormal: Vector3 = [0, 0, -1]
let planeCenter: Vector3 = [0, 0, 0]

function setup() {
    const container = document.querySelector('#vtk-root') as HTMLElement
    const genericRenderer = vtkGenericRenderWindow.newInstance({
        background: [0, 0, 0]
    })
    genericRenderer.setContainer(container)
    genericRenderer.resize()
    renderer = genericRenderer.getRenderer()
    renderWindow = genericRenderer.getRenderWindow()

    // si la vista va a ser 2D
    renderer.getActiveCamera().setParallelProjection(true)

    const genericRenderer3d = vtkGenericRenderWindow.newInstance({
        background: [0.1, 0.1, 0.1]
    })
    genericRenderer3d.setContainer(document.querySelector('#vtk-3d-root') as HTMLElement)
    genericRenderer3d.resize()
    renderer3d = genericRenderer3d.getRenderer()
    renderWindow3d = genericRenderer3d.getRenderWindow()
}

async function loadNifti() {
    const dataAccessHelper = DataAccessHelper.get('http') as HttpDataAccessHelper
    // @ts-ignore - bad typings
    const niftiArrayBuffer = await dataAccessHelper.fetchBinary(niftiUrl)
    const { image: itkImage, webWorker } = await niftiReadImage({
        data: new Uint8Array(niftiArrayBuffer),
        // tienes que darle el nombre del archivo, no sé muy bien por qué
        path: niftiFile
    })
    webWorker.terminate()
    // convertir formato itk a vtk
    imageData = vtkITKHelper.convertItkToVtkImage(itkImage)
}

const slicePlane = vtkPlane.newInstance()
slicePlane.setNormal(planeNormal)
const resliceActor = vtkImageSlice.newInstance()
const resliceMapper = vtkImageResliceMapper.newInstance()
const resliceActor3d = vtkImageSlice.newInstance()

const imageOutline = vtkOutlineFilter.newInstance()

function addReslicerToRenderer() {
    planeCenter = imageData.getCenter()
    slicePlane.setOrigin(planeCenter)

    resliceMapper.setSlabType(SlabTypes.MEAN)
    resliceMapper.setSlabThickness(1)
    resliceMapper.setSlicePlane(slicePlane)

    resliceMapper.setInputData(imageData)
    resliceActor.setMapper(resliceMapper)
    resliceActor3d.setMapper(resliceMapper)

    renderer.addActor(resliceActor)
    renderer3d.addActor(resliceActor3d)

    renderWindow.getInteractor().setInteractorStyle(
        // @ts-ignore
        vtkInteractorStyleImage.newInstance({ interactionMode: 'IMAGE2D' })
    )

    imageOutline.setInputData(imageData)
    const outlineMapper = vtkMapper.newInstance()
    outlineMapper.setInputConnection(imageOutline.getOutputPort())
    const outlineActor = vtkActor.newInstance()
    outlineActor.getProperty().setColor(1, 1, 1)
    outlineActor.getProperty().setLineWidth(2)
    outlineActor.setMapper(outlineMapper)
    renderer3d.addActor(outlineActor)

    renderer.resetCamera()
    renderer.resetCameraClippingRange()
    renderer3d.resetCamera()
    renderer3d.resetCameraClippingRange()
}

function updateCameraBounds() {
    // si quieres que la cámara se ajuste a los límites de la imagen
    // por defecto se ajusta a la esfera que contiene todos los puntos
    const bounds = imageData.getBounds()
    const parallelScale = (bounds[3] - bounds[2]) / 2
    renderer.getActiveCamera().setParallelScale(parallelScale)
    renderWindow.render()
    renderWindow3d.render()
}

function updateUI() {
    const bounds = imageData.getBounds()
    const boundsEl = document.querySelector('#bounds') as HTMLElement
    boundsEl.innerText = bounds.map(b => b.toFixed(2)).join(', ')

    const centerEls = ['x', 'y', 'z'].map(axis => document.querySelector(`#c${axis}`) as HTMLInputElement)
    const normalEls = ['x', 'y', 'z'].map(axis => document.querySelector(`#n${axis}`) as HTMLInputElement)

    centerEls.forEach((el, i) => el.value = planeCenter[i].toFixed(2))
    normalEls.forEach((el, i) => el.value = planeNormal[i].toFixed(2))

    document.querySelector('#update')?.addEventListener('click', () => {
        planeCenter = centerEls.map(el => parseFloat(el.value)) as Vector3
        const vec = normalEls.map(el => parseFloat(el.value)) as Vector3
        // normalize
        const length = Math.sqrt(vec[0] ** 2 + vec[1] ** 2 + vec[2] ** 2)
        planeNormal = vec.map(v => v / length) as Vector3
        slicePlane.setNormal(planeNormal)
        slicePlane.setOrigin(planeCenter)

        // move the 2d camera, so it is placed along the normal and looks at the center
        console.log(planeCenter, planeNormal)
        const camera = renderer.getActiveCamera()
        camera.setPosition(planeCenter[0] - (planeNormal[0] * 100), planeCenter[1] - (planeNormal[1] * 100), planeCenter[2] - (planeNormal[2] * 100))
        camera.setFocalPoint(planeCenter[0], planeCenter[1], planeCenter[2])
        renderer.resetCameraClippingRange()

        renderWindow.render()
        renderWindow3d.render()
    })
}

async function main() {
    setup()
    await loadNifti()
    addReslicerToRenderer()
    updateCameraBounds()
    updateUI()
}

main()
