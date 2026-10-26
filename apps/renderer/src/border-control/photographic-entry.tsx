import React from 'react'
import {Composition,registerRoot,getInputProps} from 'remotion'
import {Photographic,type PhotographicProps} from './Photographic'
const Root=()=> <Composition id="Photographic" component={Photographic} defaultProps={getInputProps() as PhotographicProps} width={1080} height={1920} fps={30} durationInFrames={245} calculateMetadata={({props}:{props:PhotographicProps})=>({durationInFrames:props.frames})}/>
registerRoot(Root)
