<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
</script>

<T.PerspectiveCamera makeDefault position={[0, 4, 10]}>
	<OrbitControls />
</T.PerspectiveCamera>
<T.AmbientLight intensity={0.6} />
<T.Mesh>
	<T.CylinderGeometry args={[3, 3, 0.2, 48]} />
	<T.MeshStandardMaterial color="#C87D4A" />
</T.Mesh>
