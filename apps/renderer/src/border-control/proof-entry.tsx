import retiredStyles from '../../../../config/retired-styles.json'
import React from 'react'
import {Composition, registerRoot, getInputProps} from 'remotion'
import {BorderControlProof, type ProofProps} from './Proof'

const Root=()=> <Composition id="BorderControlProof" component={BorderControlProof} defaultProps={getInputProps() as ProofProps} width={1080} height={1920} fps={30} durationInFrames={480}
  calculateMetadata={({props}:{props:ProofProps})=>({width:props.shape==='tall'?1080:1920,height:props.shape==='tall'?1920:1080,durationInFrames:props.frames})}/>
if (!retiredStyles.some(row => row.kind === 'composition' && row.id === 'BorderControlProof')) registerRoot(Root)
