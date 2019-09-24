about fft/spectrometer in python
https://www.oreilly.com/library/view/elegant-scipy/9781491922927/ch04.html

digital signal processing
https://dsp.stackexchange.com/

tensorflow audio recognizer
https://www.tensorflow.org/js/tutorials/transfer/audio_recognizer

Project description:
I create a sample set of audio files. I got a reference file and then a batch of files which are e.g. too high in frequency and a batch which is to low in frequency.

I analyze these audios with an FFT, that I get a spectrogram as an image or tensor for each file. So my features are the frequencies over time. 

The audios (minus batch, plus batch) are my training set. 

The labels are "+", "-" (,"0") .
