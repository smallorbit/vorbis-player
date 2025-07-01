// import { useState, useEffect, useCallback } from 'react';
// import { youtubeService } from '../../services/youtube';
// import { adminService } from '../../services/adminService';
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
// import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
// import { Button } from '../ui/button';
// import { Alert, AlertDescription } from '../ui/alert';
// import { Card, CardContent } from '../ui/card';
// import { Checkbox } from '../ui/checkbox';
// import { Badge } from '../ui/badge';
// import { 
//   AlertDialog, 
//   AlertDialogAction, 
//   AlertDialogCancel, 
//   AlertDialogContent, 
//   AlertDialogDescription, 
//   AlertDialogFooter, 
//   AlertDialogHeader, 
//   AlertDialogTitle 
// } from '../ui/alert-dialog';
// import { Separator } from '../ui/separator';
// import { cn } from '../../lib/utils';

// type VideoMode = '80sTV' | '90sTV';

// interface VideoItem {
//   id: string;
//   thumbnailUrl: string;
//   embedUrl: string;
//   title: string;
// }

// interface VideoAdminProps {
//   onClose: () => void;
// }

// const VideoAdmin: React.FC<VideoAdminProps> = ({ onClose }) => {
//   const [selectedMode, setSelectedMode] = useState<VideoMode>('80sTV');
//   const [videos, setVideos] = useState<VideoItem[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
//   const [error, setError] = useState<string | null>(null);
//   const [showDeleteDialog, setShowDeleteDialog] = useState(false);
//   const [showSuccessDialog, setShowSuccessDialog] = useState(false);
//   const [successMessage, setSuccessMessage] = useState('');

//   const loadVideos = useCallback(async (mode: VideoMode) => {
//     setLoading(true);
//     setError(null);
//     try {
//       const videoIds = await youtubeService.loadVideoIdsFromCategory(mode);
//       const videoItems: VideoItem[] = videoIds.map(id => ({
//         id,
//         thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
//         embedUrl: youtubeService.createEmbedUrl(id, { controls: true }),
//         title: `${getModeTitle(mode)} Video ${id}`
//       }));
//       setVideos(videoItems);
//       setSelectedVideos(new Set());
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to load videos');
//       setVideos([]);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadVideos(selectedMode);
//   }, [selectedMode, loadVideos]);

//   const handleModeChange = (mode: VideoMode) => {
//     setSelectedMode(mode);
//   };

//   const toggleVideoSelection = (videoId: string) => {
//     const newSelected = new Set(selectedVideos);
//     if (newSelected.has(videoId)) {
//       newSelected.delete(videoId);
//     } else {
//       newSelected.add(videoId);
//     }
//     setSelectedVideos(newSelected);
//   };

//   const selectAllVideos = () => {
//     setSelectedVideos(new Set(videos.map(v => v.id)));
//   };

//   const deselectAllVideos = () => {
//     setSelectedVideos(new Set());
//   };

//   const deleteSelectedVideos = async () => {
//     if (selectedVideos.size === 0) return;
//     setShowDeleteDialog(true);
//   };

//   const confirmDeleteVideos = async () => {
//     try {
//       const remainingVideoIds = videos
//         .filter(video => !selectedVideos.has(video.id))
//         .map(video => video.id);
      
//       // Use admin service to download updated file
//       adminService.downloadUpdatedVideoIds(selectedMode, remainingVideoIds);

//       setSuccessMessage(`Downloaded updated ${selectedMode}-videoIds.json file. Please replace the file in src/assets/ and refresh the page.`);
//       setShowSuccessDialog(true);
//       setShowDeleteDialog(false);
      
//       // Reload videos to reflect changes (assuming user will replace file)
//       setTimeout(() => {
//         loadVideos(selectedMode);
//       }, 1000);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to delete videos');
//       setShowDeleteDialog(false);
//     }
//   };

//   const exportBackup = async () => {
//     try {
//       const videoIds = videos.map(v => v.id);
//       await adminService.exportVideoCollection(selectedMode, videoIds);
//       setSuccessMessage(`Backup exported for ${selectedMode} mode.`);
//       setShowSuccessDialog(true);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to export backup');
//     }
//   };

//   const generateHealthReport = async () => {
//     try {
//       const videoIds = videos.map(v => v.id);
//       const report = await adminService.generateHealthReport(selectedMode, videoIds);
      
//       // Download report as text file
//       const blob = new Blob([report], { type: 'text/plain' });
//       const url = URL.createObjectURL(blob);
//       const a = document.createElement('a');
//       a.href = url;
//       a.download = `${selectedMode}-health-report-${new Date().toISOString().split('T')[0]}.txt`;
//       document.body.appendChild(a);
//       a.click();
//       document.body.removeChild(a);
//       URL.revokeObjectURL(url);
      
//       setSuccessMessage('Health report downloaded successfully.');
//       setShowSuccessDialog(true);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to generate health report');
//     }
//   };

//   const getModeEmoji = (mode: VideoMode) => {
//     switch (mode) {
//       case '90sTV': return '⓽⓪s';
//       case '80sTV': return '8️⃣0️⃣s';
//       default: return '8️⃣0️⃣s';
//     }
//   };

//   const getModeTitle = (mode: VideoMode) => {
//     switch (mode) {
//       case '80sTV': return "80's TV";
//       case '90sTV': return "90's TV";
//       default: return "80's TV";
//     }
//   };

//   return (
//     <>
//       <Dialog open={true} onOpenChange={onClose}>
//         <DialogContent className="bg-neutral-800 border-neutral-700 w-full max-w-7xl h-full max-h-[90vh] overflow-hidden flex flex-col p-0">
//           <DialogHeader className="p-6 border-b border-neutral-700">
//             <DialogTitle className="text-2xl font-bold text-white mb-4">Video Management Admin</DialogTitle>
            
//             {/* Mode Selection */}
//             <Tabs value={selectedMode} onValueChange={(value) => handleModeChange(value as VideoMode)} className="mb-4">
//               <div className="flex items-center gap-4">
//                 <span className="text-white/80">Mode:</span>
//                 <TabsList className="bg-white/10 border-0">
//                   <TabsTrigger value="80sTV" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70">
//                     {getModeEmoji('80sTV')} {getModeTitle('80sTV')}
//                   </TabsTrigger>
//                   <TabsTrigger value="90sTV" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70">
//                     {getModeEmoji('90sTV')} {getModeTitle('90sTV')}
//                   </TabsTrigger>
//                 </TabsList>
//               </div>
//             </Tabs>

//             {/* Bulk Actions */}
//             <div className="flex items-center gap-4 flex-wrap">
//               <div className="text-white/60">
//                 {videos.length} total videos, {selectedVideos.size} selected
//               </div>
//               <div className="flex gap-2 flex-wrap">
//                 <Button
//                   onClick={selectAllVideos}
//                   variant="default"
//                   size="sm"
//                   className="bg-blue-600 hover:bg-blue-700"
//                 >
//                   Select All
//                 </Button>
//                 <Button
//                   onClick={deselectAllVideos}
//                   variant="secondary"
//                   size="sm"
//                   className="bg-neutral-600 hover:bg-neutral-700 text-white"
//                 >
//                   Deselect All
//                 </Button>
//                 <Button
//                   onClick={deleteSelectedVideos}
//                   disabled={selectedVideos.size === 0}
//                   variant="destructive"
//                   size="sm"
//                 >
//                   Delete Selected ({selectedVideos.size})
//                 </Button>
//                 <Separator orientation="vertical" className="h-6 bg-white/20" />
//                 <Button
//                   onClick={exportBackup}
//                   variant="default"
//                   size="sm"
//                   className="bg-green-600 hover:bg-green-700"
//                 >
//                   Export Backup
//                 </Button>
//                 <Button
//                   onClick={generateHealthReport}
//                   variant="default"
//                   size="sm"
//                   className="bg-purple-600 hover:bg-purple-700"
//                 >
//                   Health Report
//                 </Button>
//               </div>
//             </div>
//           </DialogHeader>

//           {/* Content */}
//           <div className="flex-1 overflow-auto p-6">
//             {error && (
//               <Alert variant="destructive" className="mb-6 bg-red-500/20 border-red-500/50">
//                 <AlertDescription className="text-red-200">
//                   {error}
//                 </AlertDescription>
//               </Alert>
//             )}

//             {loading ? (
//               <div className="flex items-center justify-center h-64">
//                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
//               </div>
//             ) : (
//               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
//                 {videos.map((video) => (
//                   <VideoCard
//                     key={video.id}
//                     video={video}
//                     isSelected={selectedVideos.has(video.id)}
//                     onToggleSelect={() => toggleVideoSelection(video.id)}
//                   />
//                 ))}
//               </div>
//             )}

//             {!loading && videos.length === 0 && (
//               <div className="text-center text-white/60 py-12">
//                 <p>No videos found for {selectedMode} mode.</p>
//               </div>
//             )}
//           </div>
//         </DialogContent>
//       </Dialog>

//       {/* Delete Confirmation Dialog */}
//       <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
//         <AlertDialogContent className="bg-neutral-800 border-neutral-700">
//           <AlertDialogHeader>
//             <AlertDialogTitle className="text-white">Confirm Deletion</AlertDialogTitle>
//             <AlertDialogDescription className="text-white/80">
//               Are you sure you want to delete {selectedVideos.size} video(s) from the {selectedMode} collection? This action cannot be undone.
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel className="bg-neutral-600 hover:bg-neutral-700 text-white border-neutral-600">
//               Cancel
//             </AlertDialogCancel>
//             <AlertDialogAction
//               onClick={confirmDeleteVideos}
//               className="bg-red-600 hover:bg-red-700"
//             >
//               Delete
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>

//       {/* Success Dialog */}
//       <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
//         <AlertDialogContent className="bg-neutral-800 border-neutral-700">
//           <AlertDialogHeader>
//             <AlertDialogTitle className="text-white">Success</AlertDialogTitle>
//             <AlertDialogDescription className="text-white/80">
//               {successMessage}
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogAction
//               onClick={() => setShowSuccessDialog(false)}
//               className="bg-green-600 hover:bg-green-700"
//             >
//               OK
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>
//     </>
//   );
// };

// interface VideoCardProps {
//   video: VideoItem;
//   isSelected: boolean;
//   onToggleSelect: () => void;
// }

// const VideoCard: React.FC<VideoCardProps> = ({ video, isSelected, onToggleSelect }) => {
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [thumbnailError, setThumbnailError] = useState(false);

//   return (
//     <Card className={cn(
//       "relative bg-neutral-700 border-neutral-600 overflow-hidden transition-all duration-200",
//       isSelected ? "ring-2 ring-blue-500 bg-blue-900/20" : "hover:bg-neutral-600"
//     )}>
//       <CardContent className="p-0">
//         {/* Selection Checkbox */}
//         <div className="absolute top-2 left-2 z-20">
//           <Checkbox
//             checked={isSelected}
//             onCheckedChange={onToggleSelect}
//             className="bg-white border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
//           />
//         </div>

//         {/* Video ID Badge */}
//         <div className="absolute top-2 right-2 z-10 max-w-[calc(100%-3rem)]">
//           <Badge variant="secondary" className="bg-black/80 text-white text-xs truncate">
//             {video.id}
//           </Badge>
//         </div>

//         {/* Video Preview */}
//         <div className="relative aspect-video bg-neutral-800">
//           {isPlaying ? (
//             <iframe
//               src={video.embedUrl}
//               className="w-full h-full"
//               allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
//               allowFullScreen
//             />
//           ) : (
//             <div 
//               className="relative w-full h-full cursor-pointer group"
//               onClick={() => setIsPlaying(true)}
//             >
//               {!thumbnailError ? (
//                 <img
//                   src={video.thumbnailUrl}
//                   alt={video.title}
//                   className="w-full h-full object-cover"
//                   onError={() => setThumbnailError(true)}
//                 />
//               ) : (
//                 <div className="w-full h-full bg-neutral-600 flex items-center justify-center text-white/60">
//                   No Thumbnail
//                 </div>
//               )}
              
//               {/* Play Button Overlay */}
//               <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
//                 <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center group-hover:bg-white/90 transition-colors">
//                   <svg className="w-6 h-6 ml-1 text-black" fill="currentColor" viewBox="0 0 24 24">
//                     <path d="M8 5v14l11-7z"/>
//                   </svg>
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>

//         {/* Video Info */}
//         <div className="p-3">
//           <div className="text-sm text-white/80 truncate" title={video.title}>
//             {video.title}
//           </div>
//           {isPlaying && (
//             <Button
//               onClick={() => setIsPlaying(false)}
//               variant="link"
//               size="sm"
//               className="mt-2 h-auto p-0 text-xs text-blue-400 hover:text-blue-300"
//             >
//               Stop Preview
//             </Button>
//           )}
//         </div>
//       </CardContent>
//     </Card>
//   );
// };

// export default VideoAdmin;