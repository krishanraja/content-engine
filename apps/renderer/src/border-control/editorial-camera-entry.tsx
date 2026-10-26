import React from 'react'
import {Composition,registerRoot,getInputProps} from 'remotion'
import {EditorialCameraShort,type CameraShortProps} from './EditorialCameraShort'
const Root=()=> <Composition id="EditorialCameraShort" component={EditorialCameraShort} defaultProps={getInputProps() as CameraShortProps} width={1080} height={1920} fps={30} durationInFrames={2800} calculateMetadata={({props}:{props:CameraShortProps})=>({durationInFrames:props.frames})}/>
registerRoot(Root)
