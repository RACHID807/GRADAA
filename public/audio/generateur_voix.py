import asyncio
import os
import edge_tts
import subprocess
import imageio_ffmpeg

TOTAL_DURATION_MS = 68000 # 68 secondes
VOICE = "fr-FR-HenriNeural"

timelineScript = [
    (500, "Chers frères et sœurs aèmecistes, grande annonce !"),
    (3500, "Les sous-comités 1 et 2 d'Anyama ont l'honneur d'organiser la troisième édition du Grand Rassemblement des aèmecistes d'Anyama, le Gradaa 2026 !"),
    (11500, "Le grand rendez-vous est fixé au Dimanche 4 Octobre 2026 à Anyama !"),
    (16500, "Pour participer à cet événement fraternel, l'inscription s'effectue facilement en ligne sur notre plateforme officielle !"),
    (22000, "Découvrons ensemble la plateforme et les étapes d'inscription."),
    (26000, "Étape 1. Remplissez vos informations personnelles et choisissez votre sous-comité d'origine."),
    (31000, "Étape 2. Cliquez sur Valider mon inscription."),
    (34500, "Votre inscription est validée immédiatement et transmise par e-mail !"),
    (39000, "Voici votre reçu d'inscription officiel généré automatiquement par la plateforme avec votre numéro d'inscription !"),
    (45000, "Vous pouvez télécharger votre reçu au format P D F ou le retrouver directement dans votre boîte mail !"),
    (52000, "Scannez le Q R Code à l'écran ou rendez-vous sur la plateforme pour vous inscrire dès aujourd'hui !"),
    (59000, "Sous-comités 1 et 2 Anyama. Rendez-vous le 4 Octobre 2026 !")
]

async def generate_audio_clips():
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    print("Génération des clips audio...")
    
    inputs = []
    delays = []
    for i, (time_ms, text) in enumerate(timelineScript):
        temp_filename = f"temp_clip_{i}.mp3"
        print(f" -> Création du clip {i+1} : {text[:30]}...")
        communicate = edge_tts.Communicate(text, VOICE, rate="+5%", pitch="+5Hz")
        await communicate.save(temp_filename)
        inputs.append(temp_filename)
        delays.append(time_ms)
        
    print("Assemblage avec FFmpeg...")
    
    # Create silent base track to guarantee 68 seconds output
    base_track = "base_silent.mp3"
    subprocess.run([ffmpeg_exe, "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", str(TOTAL_DURATION_MS/1000), base_track], check=True)
    
    filter_parts = []
    amix_inputs = "[0:a]" # base silent track is index 0
    for i in range(len(inputs)):
        delay = delays[i]
        filter_parts.append(f"[{i+1}:a]adelay={delay}|{delay}[s{i}]")
        amix_inputs += f"[s{i}]"
        
    filter_parts.append(f"{amix_inputs}amix=inputs={len(inputs)+1}:dropout_transition=0:normalize=0[out]")
    filter_complex = ";".join(filter_parts)
    
    cmd = [ffmpeg_exe, "-y", "-i", base_track]
    for inp in inputs:
        cmd.extend(["-i", inp])
    cmd.extend(["-filter_complex", filter_complex, "-map", "[out]", "-ac", "2", "audio.ogg"])
    
    print("Exécution FFmpeg...")
    subprocess.run(cmd, check=True)
    
    print("Nettoyage...")
    for inp in inputs:
        os.remove(inp)
    os.remove(base_track)
        
    print("Terminé ! audio.ogg généré.")

if __name__ == "__main__":
    asyncio.run(generate_audio_clips())
